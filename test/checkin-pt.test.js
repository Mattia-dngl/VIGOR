'use strict';
// Richiesta esplicita dell'utente (proposte di miglioramento, 01/09/2026):
// check-in periodico PT-cliente. Cadenza decisa dal PT per singolo cliente
// (mai fissa per tutta l'app — l'utente ha chiesto esplicitamente "chi lo
// decide quante volte va fatto il PT?" e la risposta è: il PT, per persona).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function fakeSupabaseCliente(cliente, catturaUpdate){
  return `{
    ultimoUpdate: null,
    from(table){
      const self = this;
      if(table === 'profili'){
        return {
          select(){ return this; },
          eq(col, val){ return { maybeSingle(){ return Promise.resolve({data: val===${JSON.stringify(cliente.id)} ? ${JSON.stringify(cliente)} : null, error:null}); } }; }
        };
      }
      if(table === 'rapporti_pt'){
        return {
          update(patch){
            self.ultimoUpdate = patch;
            return { eq(col,val){ self.ultimoUpdateId = val; return Promise.resolve({error:null}); } };
          }
        };
      }
      return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
    }
  }`;
}

function clienteBase(overrides){
  return Object.assign({
    id:'cli-1', nome:'Cliente Uno', email:'uno@test.it',
    dati: { logs:[], measurements:[], checkins:[] }
  }, overrides||{});
}

async function apriTabCheckin(window, rapporto, cliente){
  await run(window, `
    utenteOnline = { id: 'pt-1' };
    _rapporti = [${JSON.stringify(rapporto)}];
    sb = ${fakeSupabaseCliente(cliente)};
    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');
    document.querySelector('.pt-tab[data-pttab="checkin"]').click();
  `);
}

test('tab "Check-in" esiste nel dettaglio cliente, accanto a Riepilogo/Scheda/Dieta/Storico', async () => {
  const { window, document } = await loadApp();
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:false, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, clienteBase());
  assert.ok(document.querySelector('.pt-tab[data-pttab="checkin"]'));
  assert.match(document.getElementById('ptDettaglioCorpo').innerHTML, /Check-in periodico/);
  window.close();
});

test('check-in non attivo: si vede solo la spunta per attivarlo, niente selettore cadenza', async () => {
  const { window, document } = await loadApp();
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:false, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, clienteBase());
  assert.ok(document.getElementById('checkinAttivoToggle'));
  assert.equal(document.getElementById('checkinAttivoToggle').checked, false);
  assert.ok(!document.getElementById('checkinCadenzaSelect'), 'senza check-in attivo non deve comparire la cadenza');
  window.close();
});

test('attivare la spunta scrive checkin_attivo:true su rapporti_pt (quella riga, non altre)', async () => {
  const { window, document } = await loadApp();
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:false, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, clienteBase());
  await run(window, `
    document.getElementById('checkinAttivoToggle').checked = true;
    document.getElementById('checkinAttivoToggle').dispatchEvent(new Event('change', {bubbles:true}));
  `);
  const r = await run(window, `return { patch: sb.ultimoUpdate, id: sb.ultimoUpdateId };`);
  assert.deepEqual(r.patch, { checkin_attivo: true });
  assert.equal(r.id, 'r-1');
  // e il selettore cadenza deve comparire subito, senza dover riaprire il cliente
  assert.ok(document.getElementById('checkinCadenzaSelect'));
  window.close();
});

test('check-in attivo: il selettore mostra la cadenza già impostata dal PT, per quel cliente', async () => {
  const { window, document } = await loadApp();
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:3 };
  await apriTabCheckin(window, rapporto, clienteBase());
  assert.equal(document.getElementById('checkinCadenzaSelect').value, '3');
  window.close();
});

test('cambiare la cadenza scrive checkin_cadenza_settimane sulla riga giusta di rapporti_pt', async () => {
  const { window, document } = await loadApp();
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, clienteBase());
  await run(window, `
    document.getElementById('checkinCadenzaSelect').value = '4';
    document.getElementById('checkinCadenzaSelect').dispatchEvent(new Event('change', {bubbles:true}));
  `);
  const r = await run(window, `return { patch: sb.ultimoUpdate, id: sb.ultimoUpdateId };`);
  assert.deepEqual(r.patch, { checkin_cadenza_settimane: 4 });
  assert.equal(r.id, 'r-1');
  window.close();
});

test('storico check-in: senza check-in attivo invita ad attivarlo, senza mostrare "nessun check-in"', async () => {
  const { window, document } = await loadApp();
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:false, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, clienteBase());
  assert.match(document.getElementById('ptDettaglioCorpo').innerHTML, /Attiva il check-in qui sopra/);
  window.close();
});

test('storico check-in: con check-in attivo ma nessuno ancora compilato, dice che è vuoto', async () => {
  const { window, document } = await loadApp();
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, clienteBase());
  assert.match(document.getElementById('ptDettaglioCorpo').innerHTML, /Nessun check-in ancora compilato/);
  window.close();
});

test('storico check-in: mostra peso, sensazione e nota di ogni voce, più recente prima', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-08-25', peso:79.4, sensazione:3, nota:'Settimana pesante' },
    { id:'c2', data:'2026-09-01', peso:78.4, sensazione:4, nota:'Meglio' }
  ]}});
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, cliente);
  const html = document.getElementById('ptDettaglioCorpo').innerHTML;
  const posC2 = html.indexOf('Meglio'), posC1 = html.indexOf('Settimana pesante');
  assert.ok(posC2 > -1 && posC1 > -1 && posC2 < posC1, 'il check-in più recente (01/09) deve comparire prima di quello del 25/08');
  assert.match(html, /78\.4 kg/);
  assert.match(html, /Sensazione: 4\/5/);
  // il grafico compare solo con almeno 2 check-in con un peso registrato
  assert.ok(document.querySelector('.checkin-grafico-box svg'));
  window.close();
});
