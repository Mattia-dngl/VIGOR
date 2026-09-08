'use strict';
// Task 2a (roadmap, PIANO PRIMA confermato 07/09/2026): lato PT lo storico
// dei check-in non mostra più c.fotoUrl (base64) direttamente — le foto
// nuove hanno solo c.fotoPath (Storage privato) e vanno firmate al volo
// (createSignedUrls, un giro solo per tutta la pagina). I check-in vecchi
// non ancora migrati (c.fotoUrl) devono continuare a funzionare com'era
// prima: compatibilità durante la transizione, senza un ordine imposto con
// lo script di migrazione.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function clienteBase(overrides){
  return Object.assign({
    id:'cli-1', nome:'Cliente Uno', email:'uno@test.it',
    dati: { logs:[], measurements:[], checkins:[] }
  }, overrides||{});
}

function fakeSupabaseConStorage(cliente, urlFirmatePerPath){
  return `{
    from(table){
      if(table === 'profili'){
        return {
          select(){ return this; },
          eq(col, val){ return { maybeSingle(){ return Promise.resolve({data: val===${JSON.stringify(cliente.id)} ? ${JSON.stringify(cliente)} : null, error:null}); } }; },
          update(patch){ return { eq(){ return Promise.resolve({error:null}); } }; }
        };
      }
      return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
    },
    storage: {
      from(bucket){
        return {
          createSignedUrls(paths, scadenza){
            const mappa = ${JSON.stringify(urlFirmatePerPath)};
            return Promise.resolve({ data: paths.map(p=>({ path:p, signedUrl: mappa[p] || null, error: mappa[p] ? null : { message:'not found' } })), error: null });
          }
        };
      }
    }
  }`;
}

async function apriTabCheckin(window, rapporto, cliente, urlFirmatePerPath){
  await run(window, `
    utenteOnline = { id: 'pt-1' };
    _rapporti = [${JSON.stringify(rapporto)}];
    sb = ${fakeSupabaseConStorage(cliente, urlFirmatePerPath || {})};
    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');
    document.querySelector('.pt-tab[data-pttab="checkin"]').click();
    await new Promise(r => setTimeout(r, 0));
  `);
}

test('check-in con fotoPath (Storage): la miniatura usa l\'URL firmato, non il path grezzo', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78.4, sensazione:4, nota:'', fotoPath:'cli-1/c1.jpg' }
  ]}});
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, cliente, { 'cli-1/c1.jpg': 'https://esempio.supabase.co/firmata/cli-1/c1.jpg?token=abc' });
  const thumb = document.querySelector('.checkin-post-foto img');
  assert.ok(thumb, 'deve comparire una miniatura');
  assert.equal(thumb.getAttribute('src'), 'https://esempio.supabase.co/firmata/cli-1/c1.jpg?token=abc');
  window.close();
});

test('check-in vecchio con fotoUrl (base64, non ancora migrato): resta visibile com\'era prima', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78.4, fotoUrl:'data:image/jpeg;base64,AAAA' }
  ]}});
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, cliente, {});
  const thumb = document.querySelector('.checkin-post-foto img');
  assert.ok(thumb);
  assert.equal(thumb.getAttribute('src'), 'data:image/jpeg;base64,AAAA');
  window.close();
});

test('elenco misto (vecchi e migrati): ognuno mostra la propria foto, nessuno si confonde con l\'altro', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78, fotoPath:'cli-1/c1.jpg' },
    { id:'c2', data:'2026-08-25', creatoIl:'2026-08-25T09:00:00.000Z', peso:79, fotoUrl:'data:image/jpeg;base64,BBBB' }
  ]}});
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, cliente, { 'cli-1/c1.jpg': 'https://esempio.supabase.co/firmata/c1.jpg' });
  const src = Array.from(document.querySelectorAll('.checkin-post-foto img')).map(img=>img.getAttribute('src'));
  assert.ok(src.includes('https://esempio.supabase.co/firmata/c1.jpg'));
  assert.ok(src.includes('data:image/jpeg;base64,BBBB'));
  window.close();
});

test('se Storage non risponde (createSignedUrls fallisce), la sezione si apre comunque senza foto invece di restare rotta', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78, fotoPath:'cli-1/c1.jpg' }
  ]}});
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await run(window, `
    utenteOnline = { id: 'pt-1' };
    _rapporti = [${JSON.stringify(rapporto)}];
    sb = {
      from(table){
        if(table === 'profili'){
          return { select(){ return this; }, eq(col, val){ return { maybeSingle(){ return Promise.resolve({data: ${JSON.stringify(cliente)}, error:null}); } }; }, update(){ return { eq(){ return Promise.resolve({error:null}); } }; } };
        }
        return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
      },
      storage: { from(){ return { createSignedUrls(){ return Promise.reject(new Error('rete assente')); } }; } }
    };
    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');
    document.querySelector('.pt-tab[data-pttab="checkin"]').click();
    await new Promise(r => setTimeout(r, 0));
  `);
  assert.ok(document.getElementById('ptDettaglioCorpo').innerHTML.length > 0, 'la sezione deve comunque disegnarsi');
  assert.equal(document.querySelector('.checkin-post-foto img'), null, 'senza URL firmato, niente miniatura rotta');
  window.close();
});
