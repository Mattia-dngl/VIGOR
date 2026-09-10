'use strict';
// 10/09/2026: segnalato dall'utente che la frase "Qualcosa non ha
// funzionato" compariva già all'apertura della schermata di accesso,
// PRIMA ancora di aver provato ad accedere. Causa: mostraCloudGate() non
// nascondeva mai #cloudErr/#regErr — un errore mostrato durante un
// tentativo precedente (es. "Continua con Google" fallito) restava scritto
// e visibile anche dopo essere usciti e rientrati, o passati da "Accedi" a
// "Registrati" e viceversa, senza che nessuno avesse toccato nulla in
// QUELLA visita. Ogni punto che mostra davvero un errore chiama
// mostraCloudGate() e SUBITO DOPO mostraErroreAccesso() (mai il contrario),
// quindi pulire le caselle in testa a mostraCloudGate() è sempre sicuro:
// un errore genuino resta comunque visibile appena impostato di nuovo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('mostraCloudGate(): un errore mostrato in un tentativo precedente non resta visibile alla visita successiva', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    mostraCloudGate('accedi');
    sb = { auth: { signInWithOAuth(){ return Promise.resolve({ error:{ message:'Unsupported provider: provider is not enabled' } }); } } };
    await iniziaAccessoGoogle();
  `);
  assert.equal(document.getElementById('cloudErr').style.display, 'block', 'precondizione: l\'errore è visibile dopo il tentativo fallito');

  await run(window, `mostraCloudGate('registra');`);
  assert.equal(document.getElementById('regErr').style.display, 'none',
    'passando a "Registrati" un errore mai avvenuto lì non deve comparire da solo');

  await run(window, `mostraCloudGate('accedi');`);
  assert.equal(document.getElementById('cloudErr').style.display, 'none',
    'tornando su "Accedi" senza aver riprovato nulla, il vecchio errore non deve essere ancora lì');
  window.close();
});

test('mostraCloudGate(): un errore genuino impostato SUBITO DOPO resta visibile (la pulizia non lo nasconde)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    mostraCloudGate('accedi');
    sb = { auth: { signInWithOAuth(){ return Promise.resolve({ error:{ message:'Unsupported provider: provider is not enabled' } }); } } };
    await iniziaAccessoGoogle();
  `);
  assert.equal(document.getElementById('cloudErr').style.display, 'block');
  assert.notEqual(document.getElementById('cloudErr').textContent, '');
  window.close();
});
