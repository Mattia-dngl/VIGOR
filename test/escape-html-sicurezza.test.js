'use strict';
// Bug di sicurezza trovato in revisione (01/09/2026): escapeAttr() sostituiva
// solo `"`, ma veniva usata in 65+ punti dell'app per inserire testo (non solo
// attributi) dentro innerHTML — nomi di esercizi, note, messaggi di chat
// PT↔cliente, nomi dei giorni della scheda... Un valore contenente
// "<img src=x onerror=...>" veniva quindi ESEGUITO invece che mostrato come
// testo. customConfirm() aveva lo stesso problema: il messaggio finiva in
// innerHTML senza alcun escape.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

const PAYLOAD = '<img src=x onerror=alert(1)>';

test('escapeAttr: neutralizza tutti i caratteri speciali HTML, non solo le virgolette', async () => {
  const { window } = await loadApp();
  const r = await run(window, `return escapeAttr(${JSON.stringify(PAYLOAD)});`);
  assert.ok(!r.includes('<img'), 'il tag non deve sopravvivere così com\'è: ' + r);
  assert.match(r, /&lt;img/);
  window.close();
});

test('pannello admin: un nome/email con markup in "Richieste in attesa" non viene eseguito', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    window.__righeAdmin = [
      { id:'admin', nome:'Mattia', email:'dangelomattia2002@gmail.com', approvato:true, is_pt:false, dati:{logs:[]} },
      { id:'p1', nome: ${JSON.stringify(PAYLOAD)}, email: ${JSON.stringify(PAYLOAD)}, approvato:false, dati:{logs:[]} }
    ];
    utenteOnline = { id:'admin', email:'dangelomattia2002@gmail.com' };
    sb = { from(){ return { select(){ return this; }, order(){ return Promise.resolve({ data: window.__righeAdmin, error:null }); } }; } };
    await renderAmministrazioneOnline();
  `);
  const box = document.getElementById('elencoAttesa');
  assert.equal(box.querySelectorAll('img').length, 0,
    'il nome/email di una richiesta in attesa non deve creare un <img> reale (eseguito nella sessione dell\'admin che approva)');
  window.close();
});

test('customConfirm: il messaggio (può contenere nome/email di un profilo) non viene eseguito come HTML', async () => {
  const { window, document } = await loadApp();
  await run(window, `customConfirm(${JSON.stringify('Eliminare "' + PAYLOAD + '"?')}, ()=>{});`);
  const box = document.querySelector('.custom-confirm-box');
  assert.ok(box, 'il popup di conferma deve comparire');
  assert.equal(box.querySelectorAll('img').length, 0, 'il testo del messaggio non deve creare un <img> reale');
  window.close();
});

test('customConfirm: gli "a-capo" (\\n) nel messaggio restano visibili come interruzioni di riga', async () => {
  const { window, document } = await loadApp();
  await run(window, `customConfirm("Riga uno\\n\\nRiga due", ()=>{});`);
  const p = document.querySelector('.custom-confirm-box p');
  assert.equal(p.querySelectorAll('br').length, 2);
  window.close();
});
