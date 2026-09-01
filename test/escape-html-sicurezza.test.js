'use strict';
// Bug di sicurezza trovato in revisione (01/09/2026): escapeAttr() sostituiva
// solo `"`, ma veniva usata in 65+ punti dell'app per inserire testo (non solo
// attributi) dentro innerHTML — nomi di esercizi, note, messaggi di chat
// PT↔cliente, nomi dei giorni della scheda... Un valore contenente
// "<img src=x onerror=...>" veniva quindi ESEGUITO invece che mostrato come
// testo. Il caso più diretto: il nome scelto in fase di REGISTRAZIONE
// (js/ui/profile-gate.js createProfileBtn non lo valida) finisce, non
// escapato, nella lista profili (chiunque apra l'app lo vede, PRIMA del
// login) e nel pannello admin "Gestione utenti" (eseguito nella sessione di
// chi approva il nuovo account). customConfirm() aveva lo stesso problema:
// il messaggio finiva in innerHTML senza alcun escape.
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

test('registrazione profilo locale: un nome con markup non viene eseguito nella lista profili (prima del login)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [{ id:'x1', name: ${JSON.stringify(PAYLOAD)}, email:'x@test.it',
      approvato:true, bloccato:false, passwordHash: simpleHash('1234'), logs:[] }];
    renderProfileGate();
  `);
  const list = document.getElementById('profileList');
  assert.equal(list.querySelectorAll('img').length, 0,
    'il nome del profilo non deve creare un <img> reale nella lista (stored XSS)');
  assert.ok(list.innerHTML.includes('&lt;img'), 'deve comparire come testo escapato');
  window.close();
});

test('pannello admin (locale): un nome/email con markup in "Richieste in attesa" non viene eseguito', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [
      { id:'admin', name:'Mattia', email:'dangelomattia2002@gmail.com', approvato:true, bloccato:false, logs:[] },
      { id:'p1', name: ${JSON.stringify(PAYLOAD)}, email: ${JSON.stringify(PAYLOAD)}, approvato:false, bloccato:false, logs:[] }
    ];
    activeProfileId = 'admin';
    renderAmministrazione();
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
