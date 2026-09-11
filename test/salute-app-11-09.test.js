'use strict';
// SALUTE APP (11/09/2026) — prima pagina della console del proprietario.
//
// error_logs raccoglieva crash veri da agosto senza che nessuno potesse
// rileggerli: sul database c'era una policy INSERT per chiunque e NESSUNA
// SELECT. Aggiunta la lettura riservata all'amministratore, qui c'è la
// pagina che li mostra raggruppati per messaggio.
//
// Quello che questi test difendono: il raggruppamento (17 occorrenze dello
// stesso crash sono UNA riga), il fatto che la sezione sia davvero
// riservata, e che i messaggi d'errore — che sono testo arbitrario venuto
// dal browser di qualcun altro — finiscano nella pagina come testo e non
// come HTML.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

// finto Supabase che restituisce le righe date sulla tabella error_logs
function fakeSb(righe, errore){
  return `{
    from(tabella){
      return {
        select(){ return this; },
        gte(){ return this; },
        order(){ return this; },
        limit(){ return Promise.resolve({ data: ${JSON.stringify(righe)}, error: ${JSON.stringify(errore || null)} }); }
      };
    }
  }`;
}

const ORA = new Date().toISOString();
const IERI = new Date(Date.now() - 26*3600000).toISOString();
const VECCHIO = new Date(Date.now() - 12*86400000).toISOString();

test('raggruppa le occorrenze dello stesso messaggio in una riga sola', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([
      { id:'1', creato_il: VECCHIO, messaggio:'Script error.', stack:null, tipo:'errore', url:'/', user_agent:'Safari', profilo_id:'p1' },
      { id:'2', creato_il: VECCHIO, messaggio:'Script error.', stack:null, tipo:'errore', url:'/', user_agent:'Safari', profilo_id:'p1' },
      { id:'3', creato_il: VECCHIO, messaggio:'Script error.', stack:null, tipo:'errore', url:'/', user_agent:'Safari', profilo_id:'p2' },
      { id:'4', creato_il: VECCHIO, messaggio:"prof.programs.length non definito", stack:'at home.js:12', tipo:'errore', url:'/', user_agent:'Safari', profilo_id:'p1' }
    ])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
  `);
  const righe = document.querySelectorAll('#saluteCorpo .salute-riga');
  assert.equal(righe.length, 2, 'quattro occorrenze, due problemi distinti');
  const testo = document.getElementById('saluteCorpo').textContent;
  assert.match(testo, /3 volte/);          // Script error. raggruppato
  assert.match(testo, /2 persone/);        // profili distinti dentro il gruppo
  window.close();
});

test('i tre numeri in cima contano occorrenze, tipi e persone distinte', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([
      { id:'1', creato_il: VECCHIO, messaggio:'A', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' },
      { id:'2', creato_il: VECCHIO, messaggio:'A', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p2' },
      { id:'3', creato_il: VECCHIO, messaggio:'B', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' }
    ])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
  `);
  const numeri = [...document.querySelectorAll('#saluteCorpo .pt-riepilogo-stat b')].map(b => b.textContent);
  // 3 occorrenze · 2 tipi · 2 persone distinte (p1 compare in entrambi i tipi:
  // non va contata due volte)
  assert.deepEqual(numeri, ['3', '2', '2']);
  window.close();
});

test('un errore di oggi alza l\'avviso, altrimenti la pagina dice che è tranquilla', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([{ id:'1', creato_il: ORA, messaggio:'Crash di adesso', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' }])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
  `);
  assert.ok(document.querySelector('#saluteCorpo .acct-highlight-card.stato-warn'), 'avviso arancione atteso');

  const b = await loadApp();
  await run(b.window, `
    sb = ${fakeSb([{ id:'1', creato_il: VECCHIO, messaggio:'Roba vecchia', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' }])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
  `);
  assert.ok(b.document.querySelector('#saluteCorpo .acct-highlight-card.stato-ok'), 'avviso verde atteso');
  window.close(); b.window.close();
});

test('senza errori nel periodo lo dice, invece di mostrare una lista vuota', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
  `);
  assert.match(document.getElementById('saluteCorpo').textContent, /Nessun errore in 30 giorni/);
  assert.equal(document.querySelectorAll('#saluteCorpo .salute-riga').length, 0);
  window.close();
});

test('chi non è l\'amministratore non legge niente, nemmeno se apre la finestra', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([{ id:'1', creato_il: ORA, messaggio:'segreto', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' }])};
    utenteOnline = { id:'altro', email:'qualcunaltro@gmail.com' };
    await caricaSaluteApp();
  `);
  const testo = document.getElementById('saluteCorpo').textContent;
  assert.match(testo, /riservata/i);
  assert.doesNotMatch(testo, /segreto/);
  window.close();
});

test('un errore respinto dal database viene detto, non ingoiato', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb(null, { message: 'permission denied for table error_logs' })};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
  `);
  assert.match(document.getElementById('saluteCorpo').textContent, /permission denied/);
  window.close();
});

test('il messaggio d\'errore finisce nella pagina come testo, mai come HTML', async () => {
  // I messaggi arrivano dal browser di altre persone e sono testo arbitrario:
  // se venissero interpretati, un errore contenente markup diventerebbe una
  // falla eseguita proprio nella pagina dell'amministratore.
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([{ id:'1', creato_il: VECCHIO, messaggio:'<img src=x onerror=alert(1)>', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' }])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
  `);
  const corpo = document.getElementById('saluteCorpo');
  assert.equal(corpo.querySelectorAll('img').length, 0, 'nessun tag creato dal messaggio');
  assert.match(corpo.textContent, /<img src=x onerror=alert\(1\)>/);
  window.close();
});

test('l\'ordinamento cambia davvero l\'ordine delle righe', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([
      { id:'1', creato_il: IERI, messaggio:'RECENTE ma raro', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' },
      { id:'2', creato_il: VECCHIO, messaggio:'VECCHIO ma frequente', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' },
      { id:'3', creato_il: VECCHIO, messaggio:'VECCHIO ma frequente', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' },
      { id:'4', creato_il: VECCHIO, messaggio:'VECCHIO ma frequente', stack:'s', tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' }
    ])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
  `);
  const primo = () => document.querySelector('#saluteCorpo .salute-riga .salute-msg').textContent;
  assert.match(primo(), /RECENTE/, 'di default i più recenti in cima');

  await run(window, `document.querySelector('#saluteOrdine [data-ordine="frequenti"]').click();`);
  assert.match(primo(), /frequente/, 'per frequenza cambia la testa della lista');
  window.close();
});

test('toccando una riga si apre lo stack, e la seconda volta si richiude', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([{ id:'1', creato_il: VECCHIO, messaggio:'Crash con stack', stack:'at scheda-editor.js:412', tipo:'errore', url:'/index.html', user_agent:'Safari', profilo_id:'p1' }])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
  `);
  assert.equal(document.querySelectorAll('#saluteCorpo .salute-stack').length, 0);

  await run(window, `document.querySelector('#saluteCorpo .salute-riga-testa').click();`);
  assert.match(document.querySelector('#saluteCorpo .salute-stack').textContent, /scheda-editor\.js:412/);

  await run(window, `document.querySelector('#saluteCorpo .salute-riga-testa').click();`);
  assert.equal(document.querySelectorAll('#saluteCorpo .salute-stack').length, 0);
  window.close();
});

test('un "Script error." viene marcato non diagnosticabile invece di far perdere tempo', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([{ id:'1', creato_il: VECCHIO, messaggio:'Script error.', stack:null, tipo:'errore', url:'/', user_agent:'x', profilo_id:'p1' }])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    await caricaSaluteApp();
    document.querySelector('#saluteCorpo .salute-riga-testa').click();
  `);
  const corpo = document.getElementById('saluteCorpo');
  assert.ok(corpo.querySelector('.salute-barra.muto'), 'barra "muto" attesa');
  assert.match(corpo.textContent, /senza stack/);
  assert.match(corpo.textContent, /altro dominio/);
  window.close();
});

test('il bottone in Gestione app apre la finestra, la × la chiude', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    sb = ${fakeSb([])};
    utenteOnline = { id:'test-uid', email:'dangelomattia2002@gmail.com' };
    document.getElementById('apriSaluteBtn').click();
  `);
  assert.ok(document.getElementById('saluteOverlay').classList.contains('show'));
  await run(window, `document.getElementById('saluteChiudi').click();`);
  assert.equal(document.getElementById('saluteOverlay').classList.contains('show'), false);
  window.close();
});
