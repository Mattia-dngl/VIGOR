'use strict';
// Richiesta esplicita dell'utente (02/09/2026): l'anteprima della foto nel
// check-in era "orrenda" (un <img> nudo), il PT non vedeva mai la foto vera
// nello storico (solo la scritta "foto allegata"), le 5 sezioni del dettaglio
// cliente (Riepilogo/Scheda/Dieta/Storico/Check-in) uscivano dallo schermo
// costringendo a scorrere in orizzontale, e non c'era nessuna notifica in
// tempo reale (né per un check-in ricevuto né per una richiesta di essere
// seguiti). Questo file copre le quattro correzioni.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function clienteBase(overrides){
  return Object.assign({
    id:'cli-1', nome:'Cliente Uno', email:'uno@test.it',
    dati: { logs:[], measurements:[], checkins:[] }
  }, overrides||{});
}

function fakeSupabaseCliente(cliente){
  return `{
    ultimoUpdate: null,
    from(table){
      const self = this;
      if(table === 'profili'){
        return {
          select(){ return this; },
          eq(col, val){ return { maybeSingle(){ return Promise.resolve({data: val===${JSON.stringify(cliente.id)} ? ${JSON.stringify(cliente)} : null, error:null}); } }; },
          update(patch){ self.ultimoUpdate = patch; return { eq(col,val){ self.ultimoUpdateId = val; return Promise.resolve({error:null}); } }; }
        };
      }
      if(table === 'rapporti_pt'){
        return { select(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
      }
      return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
    }
  }`;
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

// ---------------------------------------------------------------
// 1) lato PT: la foto vera, non solo "foto allegata"
// ---------------------------------------------------------------

test('storico check-in (PT): mostra una miniatura vera della foto, non più solo "📷 foto allegata"', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78.4, sensazione:4, nota:'', fotoUrl:'data:image/jpeg;base64,AAAA' }
  ]}});
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, cliente);
  const html = document.getElementById('ptDettaglioCorpo').innerHTML;
  assert.doesNotMatch(html, /foto allegata/, 'non deve più mostrare solo il testo');
  assert.ok(document.querySelector('.checkin-post'), 'la voce con foto deve usare la card "post"');
  const thumb = document.querySelector('.checkin-post-foto img');
  assert.ok(thumb, 'deve comparire una miniatura <img> reale');
  assert.equal(thumb.getAttribute('src'), 'data:image/jpeg;base64,AAAA');
  window.close();
});

test('storico check-in (PT): toccare la miniatura apre la foto a schermo intero, con data e peso in didascalia', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78.4, sensazione:null, nota:'', fotoUrl:'data:image/jpeg;base64,BBBB' }
  ]}});
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, cliente);
  assert.equal(document.getElementById('fotoIngranditaOverlay').classList.contains('show'), false);
  document.querySelector('.checkin-post-foto').click();
  assert.equal(document.getElementById('fotoIngranditaOverlay').classList.contains('show'), true);
  assert.equal(document.getElementById('fotoIngranditaImg').getAttribute('src'), 'data:image/jpeg;base64,BBBB');
  assert.match(document.getElementById('fotoIngranditaCaption').textContent, /78\.4 kg/);
  document.getElementById('fotoIngranditaChiudi').click();
  assert.equal(document.getElementById('fotoIngranditaOverlay').classList.contains('show'), false);
  assert.equal(document.getElementById('fotoIngranditaImg').hasAttribute('src'), false);
  window.close();
});

test('aprire la sezione Check-in di un cliente segna i suoi check-in come visti dal PT (checkinVistaPtIl)', async () => {
  const { window } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78.4 }
  ]}});
  const rapporto = { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1 };
  await apriTabCheckin(window, rapporto, cliente);
  const r = await run(window, `return { patch: sb.ultimoUpdate, id: sb.ultimoUpdateId };`);
  assert.equal(r.id, 'cli-1');
  assert.ok(r.patch && r.patch.dati && r.patch.dati.checkinVistaPtIl, 'deve scrivere checkinVistaPtIl sul profilo del cliente');
  window.close();
});

// ---------------------------------------------------------------
// 2) lato cliente: anteprima della foto incorniciata, con tasto per toglierla
// ---------------------------------------------------------------

test('check-in cliente: l\'anteprima della foto sta in una cornice con un tasto per rimuoverla', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    _checkinFotoDataUrl = 'data:image/jpeg;base64,CCCC';
    const anteprima = document.getElementById('checkinFotoAnteprima');
    anteprima.querySelector('img').src = _checkinFotoDataUrl;
    anteprima.style.display = 'flex';
  `);
  const anteprima = document.getElementById('checkinFotoAnteprima');
  assert.ok(anteprima.classList.contains('checkin-foto-anteprima'));
  assert.ok(document.getElementById('checkinFotoRimuovi'), 'deve esserci un tasto per rimuovere la foto scelta');
  document.getElementById('checkinFotoRimuovi').click();
  assert.equal(anteprima.style.display, 'none');
  const r = await run(window, `return {
    valore: _checkinFotoDataUrl,
    haSrc: document.getElementById('checkinFotoAnteprima').querySelector('img').hasAttribute('src')
  };`);
  assert.equal(r.valore, null);
  assert.equal(r.haSrc, false);
  window.close();
});

test('check-in cliente: la foto si cattura a risoluzione più alta e qualità JPEG più alta di prima (era sfocata)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pt', 'checkin-cliente.js'), 'utf8');
  assert.match(src, /const lato = 960/, 'il lato lungo del ridimensionamento deve essere più grande di 480px');
  assert.match(src, /toDataURL\('image\/jpeg', 0\.85\)/, 'la qualità JPEG deve essere più alta di .75');
  assert.match(src, /imageSmoothingQuality = 'high'/, 'il downscale deve usare il filtro di qualità migliore del canvas');
});

// ---------------------------------------------------------------
// 3) le 5 sezioni del dettaglio cliente stanno tutte in vista, senza carosello
// ---------------------------------------------------------------

test('le 5 sezioni del dettaglio cliente (pt-tab) sono colonne di larghezza uguale, non "auto" sul contenuto', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id: 'pt-1' };
    _rapporti = [{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', checkin_attivo:false, checkin_cadenza_settimane:1 }];
    sb = ${fakeSupabaseCliente(clienteBase())};
    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');
  `);
  const tabs = document.querySelectorAll('.pt-tab');
  assert.equal(tabs.length, 5, 'Riepilogo/Scheda/Dieta/Storico/Check-in');
  window.close();
});

test('CSS: .pt-tab usa colonne a larghezza uguale (flex-basis 0) invece che "auto", per starci tutte e 5 senza scorrimento', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const regola = css.match(/\.pt-tab\{[^}]*\}/);
  assert.ok(regola, 'deve esistere la regola .pt-tab');
  assert.match(regola[0], /flex:\s*1\s+1\s+0\b/, 'flex-basis deve essere 0 (colonne uguali), non "auto" sul contenuto');
});

// ---------------------------------------------------------------
// 4) notifiche: check-in ricevuto (lato PT), sia nella lista sia nel pallino
// ---------------------------------------------------------------

function fakeSupabaseNotifiche(cliente){
  return `{
    from(table){
      if(table === 'profili'){
        return { select(){ return this; }, eq(col, val){ return { maybeSingle(){
          return Promise.resolve({ data: val===${JSON.stringify(cliente.id)} ? ${JSON.stringify(cliente)} : null, error:null });
        } }; } };
      }
      if(table === 'messaggi'){
        // neq() è l'ultimo passo sia per aggiornaCampanellaHome (await diretto)
        // sia, incatenato con .order(...), per renderNotifiche: una Promise con
        // un metodo order() attaccato sopra copre entrambi gli usi.
        return { select(){ return this; }, in(){ return this; }, eq(){ return this; },
          neq(){ const p = Promise.resolve({data:[], error:null, count:0}); p.order = ()=>Promise.resolve({data:[], error:null}); return p; } };
      }
      return { select(){return this;}, eq(){return this;}, or(){return Promise.resolve({data:[],error:null});} };
    }
  }`;
}

test('renderNotifiche (PT): un check-in non ancora visto compare come notifica', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78.4 }
  ]}});
  await run(window, `
    utenteOnline = { id:'pt-1' }; rigaOnline = { id:'pt-1', is_pt:true };
    _rapporti = [{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo' }];
    sb = ${fakeSupabaseNotifiche(cliente)};
    await renderNotifiche();
  `);
  assert.match(document.getElementById('notifCorpo').innerHTML, /Cliente Uno ha inviato un check-in/);
  window.close();
});

test('renderNotifiche (PT): il check-in già visto (checkinVistaPtIl più recente) non compare più', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78.4 }
  ], checkinVistaPtIl:'2026-09-01T12:00:00.000Z' }});
  await run(window, `
    utenteOnline = { id:'pt-1' }; rigaOnline = { id:'pt-1', is_pt:true };
    _rapporti = [{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo' }];
    sb = ${fakeSupabaseNotifiche(cliente)};
    await renderNotifiche();
  `);
  assert.doesNotMatch(document.getElementById('notifCorpo').innerHTML, /ha inviato un check-in/);
  window.close();
});

test('aggiornaCampanellaHome (PT): un check-in non visto accende il pallino', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { logs:[], measurements:[], checkins:[
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z', peso:78.4 }
  ]}});
  await run(window, `
    utenteOnline = { id:'pt-1' }; rigaOnline = { id:'pt-1', is_pt:true };
    _rapporti = [{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo' }];
    sb = ${fakeSupabaseNotifiche(cliente)};
    await aggiornaCampanellaHome();
  `);
  assert.equal(document.getElementById('homeBellDot').style.display, 'block');
  window.close();
});

// ---------------------------------------------------------------
// 5) notifiche in tempo reale: check-in e richiesta PT appena arrivano
// ---------------------------------------------------------------

function fakeSupabaseRealtime(clienteId, cliente){
  return `{
    _handlers: {},
    from(table){
      if(table === 'profili'){
        return { select(){ return this; }, eq(col, val){ return { maybeSingle(){
          return Promise.resolve({ data: val===${JSON.stringify(clienteId)} ? ${JSON.stringify(cliente)} : null, error:null });
        } }; } };
      }
      if(table === 'rapporti_pt'){
        return { select(){ return this; }, or(){ return Promise.resolve({ data:[{ id:'r-1', cliente_id:${JSON.stringify(clienteId)}, pt_id:'pt-1', stato:'attivo' }], error:null }); } };
      }
      return { select(){return this;}, eq(){return this;}, in(){return this;}, neq(){return Promise.resolve({data:[],error:null,count:0});}, or(){return Promise.resolve({data:[],error:null});} };
    },
    channel(nome){
      const self = this;
      return { on(evt, opts, cb){ self._handlers[nome] = cb; return this; }, subscribe(){ return this; } };
    },
    removeChannel(){}
  }`;
}

test('ascoltaNotificheRealtime: un nuovo check-in dal cliente fa comparire una notifica tappabile subito, senza riaprire nulla', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { checkins: [
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z' }
  ] } });
  await run(window, `
    utenteOnline = { id:'pt-1' }; rigaOnline = { id:'pt-1', is_pt:true };
    sb = ${fakeSupabaseRealtime('cli-1', cliente)};
    await caricaRapporti();
    await ascoltaNotificheRealtime();
  `);
  const nuovoCliente = Object.assign({}, cliente, { dati: { checkins: cliente.dati.checkins.concat([
    { id:'c2', data:'2026-09-02', creatoIl:'2026-09-02T08:00:00.000Z' }
  ]) } });
  await run(window, `
    const cb = sb._handlers['rt-checkin-cli-1'];
    await cb({ new: ${JSON.stringify(nuovoCliente)} });
  `);
  const el = document.querySelector('.rt-notifica');
  assert.ok(el, 'la notifica realtime deve apparire subito');
  assert.match(el.textContent, /Cliente Uno ha inviato un check-in/);
  window.close();
});

test('ascoltaNotificheRealtime: un secondo evento sullo stesso profilo SENZA nuovi check-in non genera un\'altra notifica', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBase({ dati: { checkins: [
    { id:'c1', data:'2026-09-01', creatoIl:'2026-09-01T09:00:00.000Z' }
  ] } });
  await run(window, `
    utenteOnline = { id:'pt-1' }; rigaOnline = { id:'pt-1', is_pt:true };
    sb = ${fakeSupabaseRealtime('cli-1', cliente)};
    await caricaRapporti();
    await ascoltaNotificheRealtime();
  `);
  await run(window, `
    const cb = sb._handlers['rt-checkin-cli-1'];
    await cb({ new: ${JSON.stringify(cliente)} }); // stesso numero di check-in di prima: nessuna novità
  `);
  assert.equal(document.querySelectorAll('.rt-notifica').length, 0);
  window.close();
});

test('ascoltaNotificheRealtime: una richiesta di essere seguito appena arrivata genera una notifica tappabile', async () => {
  const { window, document } = await loadApp();
  const richiedente = { id:'cli-2', nome:'Nuova Cliente', dati:{} };
  await run(window, `
    utenteOnline = { id:'pt-1' }; rigaOnline = { id:'pt-1', is_pt:true };
    sb = ${fakeSupabaseRealtime('cli-2', richiedente)};
    await caricaRapporti();
    await ascoltaNotificheRealtime();
  `);
  await run(window, `
    const cb = sb._handlers['rt-richieste-pt-pt-1'];
    await cb({ new: { id:'r-2', cliente_id:'cli-2', pt_id:'pt-1', stato:'in_attesa' } });
  `);
  const el = document.querySelector('.rt-notifica');
  assert.ok(el);
  assert.match(el.textContent, /Nuova Cliente vuole essere seguito da te/);
  window.close();
});
