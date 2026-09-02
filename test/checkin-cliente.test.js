'use strict';
// Richiesta esplicita dell'utente (proposte di miglioramento, 01/09/2026):
// check-in periodico, lato cliente — promemoria (quando il PT lo ha attivato
// e la cadenza che ha scelto per te dice che è ora) e modulo di compilazione.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function fakeSupabaseMioPT(rapporto){
  return `{
    from(table){
      if(table === 'rapporti_pt'){
        return { select(){ return this; }, or(){ return Promise.resolve({ data:[${JSON.stringify(rapporto)}], error:null }); } };
      }
      if(table === 'profili'){
        return { select(){ return this; }, eq(col, val){ return { maybeSingle(){
          return Promise.resolve({ data:{ id:'pt-1', nome:'Marco Rossi', dati:{} }, error:null }); } }; } };
      }
      return { select(){ return this; }, eq(){ return this; }, or(){ return Promise.resolve({data:[],error:null}); } };
    }
  }`;
}

function profiloBase(overrides){
  return Object.assign({
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], checkins:[],
    customExercises:{}, customFoods:{}, mealLogs:[], waterLogs:[],
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      durataSettimane:null, dataInizio:null, notePT:null, days:[], dietInfo:{}, diet:{} }],
    activeProgramId:'p1'
  }, overrides||{});
}

// ---------------------------------------------------------------
// calcolo puro (prossimoCheckinScadenza / checkinDovuto)
// ---------------------------------------------------------------

test('checkinDovuto: false se il PT non lo ha attivato per questo cliente', async () => {
  const { window } = await loadApp();
  const r = await run(window, `return checkinDovuto({ checkin_attivo:false, checkin_cadenza_settimane:1 }, []);`);
  assert.equal(r, false);
});

test('checkinDovuto: senza check-in precedenti, conta dalla data in cui il rapporto è diventato attivo', async () => {
  const { window } = await loadApp();
  const lontano = new Date(Date.now() - 20*86400000).toISOString(); // 20 giorni fa
  const vicino = new Date(Date.now() - 2*86400000).toISOString();   // 2 giorni fa
  const r = await run(window, `
    return {
      dovutoDaTanto: checkinDovuto({ checkin_attivo:true, checkin_cadenza_settimane:1, accettato_il:${JSON.stringify(lontano)} }, []),
      appenaIniziato: checkinDovuto({ checkin_attivo:true, checkin_cadenza_settimane:1, accettato_il:${JSON.stringify(vicino)} }, [])
    };
  `);
  assert.equal(r.dovutoDaTanto, true, 'più di una settimana (cadenza 1) dall\'inizio del rapporto: dovuto');
  assert.equal(r.appenaIniziato, false, 'solo 2 giorni fa, cadenza settimanale: non ancora dovuto');
});

test('checkinDovuto: con un check-in già fatto, conta da QUELLO, non dall\'inizio del rapporto', async () => {
  const { window } = await loadApp();
  const moltoIndietro = new Date(Date.now() - 60*86400000).toISOString();
  const treGiorniFa = new Date(Date.now() - 3*86400000).toISOString().slice(0,10);
  const r = await run(window, `
    return checkinDovuto(
      { checkin_attivo:true, checkin_cadenza_settimane:1, accettato_il:${JSON.stringify(moltoIndietro)} },
      [{ id:'c1', data:${JSON.stringify(treGiorniFa)} }]
    );
  `);
  assert.equal(r, false, 'ultimo check-in 3 giorni fa, cadenza settimanale: non ancora dovuto, anche se il rapporto è vecchio');
});

test('checkinDovuto: rispetta la cadenza scelta dal PT per QUESTO cliente (non un valore fisso)', async () => {
  const { window } = await loadApp();
  const dieciGiorniFa = new Date(Date.now() - 10*86400000).toISOString().slice(0,10);
  const r = await run(window, `
    return {
      cadenzaUnaSettimana: checkinDovuto({ checkin_attivo:true, checkin_cadenza_settimane:1 }, [{data:${JSON.stringify(dieciGiorniFa)}}]),
      cadenzaQuattroSettimane: checkinDovuto({ checkin_attivo:true, checkin_cadenza_settimane:4 }, [{data:${JSON.stringify(dieciGiorniFa)}}])
    };
  `);
  assert.equal(r.cadenzaUnaSettimana, true, '10 giorni dopo, cadenza 1 settimana: dovuto');
  assert.equal(r.cadenzaQuattroSettimane, false, '10 giorni dopo, cadenza 4 settimane: non ancora');
});

// ---------------------------------------------------------------
// promemoria in "Il mio PT"
// ---------------------------------------------------------------

test('renderMioPT: check-in non attivato dal PT, nessuna riga check-in mostrata', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    window.modalitaOnline = () => true;
    utenteOnline = { id: 'io' };
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    sb = ${fakeSupabaseMioPT({ id:'r1', cliente_id:'io', pt_id:'pt-1', stato:'attivo', checkin_attivo:false, checkin_cadenza_settimane:1, accettato_il:'2026-08-01T00:00:00Z' })};
    await renderMioPT();
  `);
  assert.ok(!document.querySelector('.pt-checkin-riga'));
  window.close();
});

test('renderMioPT: check-in attivato ma non ancora dovuto, mostra la cadenza (non l\'avviso urgente)', async () => {
  const { window, document } = await loadApp();
  const ieri = new Date(Date.now() - 86400000).toISOString();
  await run(window, `
    window.modalitaOnline = () => true;
    utenteOnline = { id: 'io' };
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    sb = ${fakeSupabaseMioPT({ id:'r1', cliente_id:'io', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:2, accettato_il:ieri })};
    await renderMioPT();
  `);
  const riga = document.querySelector('.pt-checkin-riga');
  assert.ok(riga);
  assert.ok(!riga.classList.contains('dovuto'));
  assert.match(riga.querySelector('.pt-checkin-label').textContent, /ogni 2 settimane/);
  assert.ok(document.getElementById('apriCheckinBtn'));
  window.close();
});

test('renderMioPT: check-in dovuto, mostra l\'avviso evidenziato', async () => {
  const { window, document } = await loadApp();
  const moltoIndietro = new Date(Date.now() - 30*86400000).toISOString();
  await run(window, `
    window.modalitaOnline = () => true;
    utenteOnline = { id: 'io' };
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    sb = ${fakeSupabaseMioPT({ id:'r1', cliente_id:'io', pt_id:'pt-1', stato:'attivo', checkin_attivo:true, checkin_cadenza_settimane:1, accettato_il:moltoIndietro })};
    await renderMioPT();
  `);
  const riga = document.querySelector('.pt-checkin-riga');
  assert.ok(riga.classList.contains('dovuto'));
  assert.match(riga.querySelector('.pt-checkin-label').textContent, /Check-in da fare/);
  window.close();
});

// ---------------------------------------------------------------
// compilazione
// ---------------------------------------------------------------

test('apriCheckinCompilazione: apre l\'overlay pulito, precompilato con l\'ultimo peso registrato', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase({ measurements:[{date:'2026-08-01', weight:80}, {date:'2026-08-20', weight:78.5}] }))}];
    activeProfileId = 'io';
    apriCheckinCompilazione();
  `);
  assert.ok(document.getElementById('checkinCompilaOverlay').classList.contains('show'));
  assert.equal(document.getElementById('checkinPeso').value, '78.5');
  assert.equal(document.querySelectorAll('#checkinSensazioneToggle .seg-btn.active').length, 0);
  window.close();
});

test('invio check-in: senza compilare nulla, avvisa e non salva niente', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    apriCheckinCompilazione();
    document.getElementById('checkinPeso').value = '';
    document.getElementById('checkinInviaBtn').click();
  `);
  const r = await run(window, `return { checkins: activeProfile().checkins, ancoraAperto: document.getElementById('checkinCompilaOverlay').classList.contains('show') };`);
  assert.equal(r.checkins.length, 0);
  assert.ok(r.ancoraAperto, 'resta aperto: niente da salvare');
  window.close();
});

test('invio check-in: peso + sensazione + nota vengono salvati sul profilo e l\'overlay si chiude', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    apriCheckinCompilazione();
    document.getElementById('checkinPeso').value = '77.2';
    document.querySelector('#checkinSensazioneToggle .seg-btn[data-val="4"]').click();
    document.getElementById('checkinNota').value = 'Settimana buona';
    document.getElementById('checkinInviaBtn').click();
  `);
  const r = await run(window, `return {
    checkins: activeProfile().checkins,
    overlayAperto: document.getElementById('checkinCompilaOverlay').classList.contains('show')
  };`);
  assert.equal(r.checkins.length, 1);
  assert.equal(r.checkins[0].peso, 77.2);
  assert.equal(r.checkins[0].sensazione, 4);
  assert.equal(r.checkins[0].nota, 'Settimana buona');
  assert.ok(r.checkins[0].id);
  assert.ok(r.checkins[0].data);
  assert.equal(r.overlayAperto, false);
  window.close();
});

test('invio check-in: basta anche un solo campo (es. solo la nota) per poter inviare', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    apriCheckinCompilazione();
    document.getElementById('checkinPeso').value = '';
    document.getElementById('checkinNota').value = 'Solo una nota, nessun altro campo';
    document.getElementById('checkinInviaBtn').click();
  `);
  const r = await run(window, `return activeProfile().checkins;`);
  assert.equal(r.length, 1);
  assert.equal(r[0].peso, null);
  assert.equal(r[0].nota, 'Solo una nota, nessun altro campo');
  window.close();
});

test('chiudere l\'overlay col tasto × non salva nulla', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    apriCheckinCompilazione();
    document.getElementById('checkinPeso').value = '75';
    document.getElementById('checkinCompilaChiudi').click();
  `);
  const r = await run(window, `return {
    checkins: activeProfile().checkins,
    overlayAperto: document.getElementById('checkinCompilaOverlay').classList.contains('show')
  };`);
  assert.equal(r.checkins.length, 0);
  assert.equal(r.overlayAperto, false);
  window.close();
});
