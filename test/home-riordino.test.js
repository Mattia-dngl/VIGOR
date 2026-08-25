'use strict';
// Test del riordino di Home chiesto dall'utente il 25/08/2026 con uno
// screenshot: "Il mio Personal Trainer" (rimandava solo a Scheda, già
// raggiungibile da lì) è stato tolto; "Area Personal Trainer" (visibile solo
// ai PT) è diventata una card a piena larghezza invece di metà di una
// griglia 2 colonne che sarebbe rimasta orfana; "Esci dall'app" è stato
// spostato da un piccolo link in fondo a Home a un bottone vero dentro
// Account (tocco più facile, e più a tema con il resto delle azioni account).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('"Il mio Personal Trainer" non esiste più in Home', async () => {
  const { window, document } = await loadApp();
  await run(window, `mostraHome();`);
  assert.equal(document.getElementById('homeMioPTBtn'), null);
  assert.equal(document.querySelector('.home-grid'), null, 'anche il vecchio contenitore a griglia è stato tolto');
  window.close();
});

test('"Area Personal Trainer" è una card a piena larghezza, non più dentro una griglia a due colonne', async () => {
  const { window, document } = await loadApp();
  const btn = document.getElementById('homePTBtn');
  assert.ok(btn, 'il bottone deve esistere');
  assert.ok(btn.classList.contains('home-pt-card'));
  assert.equal(btn.closest('.home-grid'), null, 'non deve più stare dentro un contenitore a griglia');
  assert.match(btn.textContent, /Area Personal Trainer/);
  window.close();
});

test('"Esci dall\'app" ora è un bottone vero dentro Account, non un link in fondo a Home', async () => {
  const { window, document } = await loadApp();
  await run(window, `mostraHome();`);
  const btn = document.getElementById('homeEsciBtn');
  assert.ok(btn, 'il bottone deve esistere');
  assert.equal(btn.tagName, 'BUTTON', 'deve essere un vero bottone (tocco più facile), non più un <div> testuale');
  assert.ok(btn.closest('#accountPanel'), 'deve stare dentro il pannello Account, non più dentro Home');
  assert.equal(btn.closest('#homeScreen'), null, 'non deve più stare dentro Home');
  window.close();
});

test('uscire dall\'app (modalità locale) chiude anche Account, non solo Home, e torna al gate profili', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{},
      programs:[{id:'p1', days:[]}], activeProgramId:'p1' };
    state.profiles = [profilo]; activeProfileId = 'io';
    apriAccountPanel();
  `);
  assert.equal(document.getElementById('accountPanel').style.display, 'block', 'precondizione: Account è aperto');

  await run(window, `
    document.getElementById('homeEsciBtn').click();
    document.getElementById('customConfirmOk').click();
  `);
  assert.equal(document.getElementById('accountPanel').style.display, 'none', 'Account deve richiudersi');
  assert.equal(document.getElementById('profileGate').style.display, 'flex', 'deve tornare al gate di scelta profilo');
  window.close();
});

test('annullando la conferma di uscita, Account resta aperto (nessuna uscita)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{},
      programs:[{id:'p1', days:[]}], activeProgramId:'p1' };
    state.profiles = [profilo]; activeProfileId = 'io';
    apriAccountPanel();
    document.getElementById('homeEsciBtn').click();
    document.getElementById('customConfirmCancel').click();
  `);
  assert.equal(document.getElementById('accountPanel').style.display, 'block', 'annullando, Account deve restare aperto');
  window.close();
});

test('CSS: la card PT non lascia orfano nessuno stile della vecchia griglia', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.ok(!/\.home-grid\{/.test(css), '.home-grid non deve più esistere in CSS');
  assert.ok(!/\.home-card\{/.test(css), '.home-card non deve più esistere in CSS');
  assert.ok(/\.home-pt-card\{/.test(css), 'deve esistere lo stile della nuova card a piena larghezza');
});
