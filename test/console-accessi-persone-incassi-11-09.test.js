'use strict';
// CONSOLE DEL PROPRIETARIO, punti 02/03/05 (11/09/2026):
// registro accessi, pagina Persone, pagina Incassi.
//
// Le cose che questi test difendono davvero:
//  - un ingresso registrato UNA volta per sessione, non a ogni ricaricamento
//    (altrimenti il registro conterebbe aperture di pagina, non accessi);
//  - i tentativi falliti che passano dalla edge function e mai dal client;
//  - "mai visto entrare" detto apertamente invece di inventare una data,
//    perché il registro è nato oggi e non esiste storico precedente;
//  - le pagine chiuse a chi non è l'amministratore.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

const AMM = 'dangelomattia2002@gmail.com';

// Supabase finto che registra cosa gli è stato chiesto, così i test possono
// verificare le scritture invece del solo disegno.
function sbSpia(tabelle){
  return `{
    _inseriti: [],
    _funzioni: [],
    from(t){
      const self = this;
      const righe = (${JSON.stringify(tabelle || {})})[t] || [];
      return {
        select(){ return this; },
        eq(){ return this; },
        gte(){ return this; },
        order(){ return this; },
        limit(){ return Promise.resolve({ data: righe, error:null }); },
        insert(r){ self._inseriti.push({ tabella:t, riga:r }); return Promise.resolve({ error:null }); },
        then(res){ return Promise.resolve({ data: righe, error:null }).then(res); }
      };
    },
    functions: { invoke(nome, opz){ this._chiamate = this._chiamate || []; this._chiamate.push({nome, opz}); return Promise.resolve({ data:null, error:null }); } }
  }`;
}

function entra(email){
  return `
    utenteOnline = { id:'test-uid', email:'${email}', app_metadata:{ provider:'email' } };
    rigaOnline = { id:'test-uid', email:'${email}', nome:'Io', approvato:true, is_pt:false, dati:loggedInProfile() };
    loggedInProfile().email = '${email}';
    _rapporti = [];
  `;
}

// ---------------- registro accessi ----------------

test('un ingresso riuscito viene registrato una volta sola per sessione', async () => {
  const { window } = await loadApp();
  const r = await run(window, entra(AMM) + `
    sb = ${sbSpia()};
    sessionStorage.clear();
    await registraAccessoRiuscito();
    await registraAccessoRiuscito();   // come un secondo ricaricamento di pagina
    await registraAccessoRiuscito();
    return { quante: sb._inseriti.length, riga: sb._inseriti[0] };
  `);
  assert.equal(r.quante, 1, 'tre chiamate, una riga sola');
  assert.equal(r.riga.tabella, 'accessi');
  assert.equal(r.riga.riga.profilo_id, 'test-uid');
  assert.equal(r.riga.riga.esito, 'riuscito');
  window.close();
});

test('l\'ingresso registrato non porta con sé l\'email: il profilo la contiene già', async () => {
  const { window } = await loadApp();
  const r = await run(window, entra(AMM) + `
    sb = ${sbSpia()};
    sessionStorage.clear();
    await registraAccessoRiuscito();
    return sb._inseriti[0].riga;
  `);
  assert.equal(r.email, undefined);
  assert.equal(r.ip_hash, undefined, "l'IP lo calcola solo il server, il client non lo sa");
  window.close();
});

test('l\'accesso con Google viene distinto da quello con password', async () => {
  const { window } = await loadApp();
  const r = await run(window, entra(AMM) + `
    utenteOnline.app_metadata = { provider:'google' };
    sb = ${sbSpia()};
    sessionStorage.clear();
    await registraAccessoRiuscito();
    return sb._inseriti[0].riga.metodo;
  `);
  assert.equal(r, 'google');
  window.close();
});

test('un tentativo fallito passa dalla edge function, mai dalla tabella', async () => {
  // Il client non può scrivere righe 'fallito': chi sbaglia la password non è
  // autenticato, e la policy della tabella non glielo concederebbe comunque.
  const { window } = await loadApp();
  const r = await run(window, `
    sb = ${sbSpia()};
    await registraAccessoFallito('  QUALCUNO@Gmail.com ', 'password');
    return { inseriti: sb._inseriti.length, chiamate: sb.functions._chiamate };
  `);
  assert.equal(r.inseriti, 0, 'nessuna scrittura diretta sulla tabella');
  assert.equal(r.chiamate.length, 1);
  assert.equal(r.chiamate[0].nome, 'registra-accesso-fallito');
  assert.equal(r.chiamate[0].opz.body.email, 'qualcuno@gmail.com', 'normalizzata');
  window.close();
});

test('un registro che non funziona non impedisce di entrare', async () => {
  const { window } = await loadApp();
  const r = await run(window, entra(AMM) + `
    sb = { from(){ throw new Error('database irraggiungibile'); },
           functions:{ invoke(){ throw new Error('spenta'); } } };
    sessionStorage.clear();
    await registraAccessoRiuscito();
    await registraAccessoFallito('x@y.it');
    return 'sono arrivato in fondo';
  `);
  assert.equal(r, 'sono arrivato in fondo');
  window.close();
});

// ---------------- Persone ----------------

const PROFILI = [
  { id:'p1', nome:'Tia', email:'t@x.it', is_pt:true, approvato:true, bloccato:false, creato_il:'2026-09-01' },
  { id:'p2', nome:'Desy', email:'d@x.it', is_pt:false, approvato:true, bloccato:false, creato_il:'2026-08-11' },
  { id:'p3', nome:'Nuovo', email:'n@x.it', is_pt:false, approvato:false, bloccato:false, creato_il:'2026-09-10' }
];

test('Persone usa l\'accesso più recente di ciascuno, non il primo che trova', async () => {
  const { window, document } = await loadApp();
  const oggi = new Date().toISOString();
  const vecchio = new Date(Date.now() - 20*86400000).toISOString();
  await run(window, entra(AMM) + `sb = ${sbSpia({
    profili: PROFILI,
    // arrivano ordinati dal più recente: la prima riga di p1 è quella buona
    accessi: [
      { profilo_id:'p1', creato_il: oggi },
      { profilo_id:'p1', creato_il: vecchio },
      { profilo_id:'p2', creato_il: vecchio }
    ]
  })}; await caricaPersone();`);

  const testo = document.getElementById('personeCorpo').textContent;
  assert.match(testo, /oggi/, 'Tia è entrata oggi');
  assert.match(testo, /20 giorni fa/, 'Desy è ferma da 20 giorni');
  assert.match(testo, /mai visto entrare/, 'del terzo non sappiamo ancora niente');
  window.close();
});

test('Persone dice apertamente perché di qualcuno non sa niente', async () => {
  const { window, document } = await loadApp();
  await run(window, entra(AMM) + `sb = ${sbSpia({ profili: PROFILI, accessi: [] })};
    await caricaPersone();`);
  assert.match(document.getElementById('personeCorpo').textContent,
    /registro degli accessi è partito oggi/);
  window.close();
});

test('i filtri di Persone selezionano davvero', async () => {
  const { window, document } = await loadApp();
  await run(window, entra(AMM) + `sb = ${sbSpia({ profili: PROFILI, accessi: [] })};
    await caricaPersone();`);
  const conta = () => document.querySelectorAll('#personeCorpo .r-console').length;
  assert.equal(conta(), 3, 'tutti');

  await run(window, `document.querySelector('#personeFiltri [data-f="pt"]').click();`);
  assert.equal(conta(), 1, 'un solo PT');

  await run(window, `document.querySelector('#personeFiltri [data-f="attesa"]').click();`);
  assert.equal(conta(), 1, 'un solo account non approvato');
  window.close();
});

test('le azioni che cancellano dati non vengono duplicate in Persone', async () => {
  // Eliminare o bloccare un account resta in un posto solo: due schermate che
  // fanno la stessa cosa distruttiva sono un invito a sbagliare.
  const { window, document } = await loadApp();
  await run(window, entra(AMM) + `sb = ${sbSpia({ profili: PROFILI, accessi: [] })};
    await caricaPersone();`);
  const testo = document.getElementById('personeCorpo').textContent;
  assert.doesNotMatch(testo, /Elimina/);
  assert.match(testo, /Gestione dell'app/);
  window.close();
});

// ---------------- Incassi ----------------

test('senza abbonamenti la pagina dice perché, invece di sembrare rotta', async () => {
  const { window, document } = await loadApp();
  await run(window, entra(AMM) + `sb = ${sbSpia({ abbonamenti_pt: [], profili: PROFILI })};
    await caricaIncassi();`);
  const testo = document.getElementById('incassiCorpo').textContent;
  assert.match(testo, /I pagamenti non sono accesi/);
  assert.match(testo, /webhook Stripe/);
  assert.match(testo, /1 Personal Trainer/, 'conta i PT veri sull\'app');
  window.close();
});

test('un abbonamento in scadenza entro una settimana viene segnalato', async () => {
  const { window, document } = await loadApp();
  const fra3 = new Date(Date.now() + 3*86400000).toISOString();
  await run(window, entra(AMM) + `sb = ${sbSpia({
    abbonamenti_pt: [{ pt_id:'p1', piano:'pt_pro', stato:'prova', prova_scade_il: fra3, aggiornato_il:null }],
    profili: PROFILI
  })}; await caricaIncassi();`);
  const corpo = document.getElementById('incassiCorpo');
  assert.match(corpo.textContent, /scade fra 3 giorni/);
  assert.ok(corpo.querySelector('.dot-console.warn'), 'segnalato in arancione');
  assert.ok(corpo.querySelector('[data-scrivi="p1"]'), 'con il tasto per scrivergli');
  window.close();
});

test('il memo non parte da solo: apre i messaggi e lo scrive una persona', async () => {
  const { window } = await loadApp();
  const scaduto = new Date(Date.now() - 5*86400000).toISOString();
  const r = await run(window, entra(AMM) + `sb = ${sbSpia({
    abbonamenti_pt: [{ pt_id:'p1', piano:'pt_starter', stato:'scaduto', prova_scade_il: scaduto, aggiornato_il:null }],
    profili: PROFILI
  })};` + `
    await caricaIncassi();
    let aperto = false;
    apriMessaggiHome = () => { aperto = true; };
    document.querySelector('[data-scrivi="p1"]').click();
    return { aperto, inseriti: sb._inseriti.length };
  `);
  assert.equal(r.aperto, true);
  assert.equal(r.inseriti, 0, 'nessun messaggio scritto di nascosto');
  window.close();
});

test('Persone e Incassi sono chiuse a chi non è l\'amministratore', async () => {
  const { window, document } = await loadApp();
  await run(window, entra('niccolo111203@gmail.com') + `
    sb = ${sbSpia({ profili: PROFILI, abbonamenti_pt: [] })};
    await caricaPersone();
    await caricaIncassi();
  `);
  assert.match(document.getElementById('personeCorpo').textContent, /riservata/i);
  assert.match(document.getElementById('incassiCorpo').textContent, /riservata/i);
  assert.doesNotMatch(document.getElementById('personeCorpo').textContent, /Desy/);
  window.close();
});
