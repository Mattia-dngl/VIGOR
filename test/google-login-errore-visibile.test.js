'use strict';
// 10/09/2026: segnalato dall'utente che "Continua con Google" non funziona.
// Causa: mostraErroreAccesso() scriveva SEMPRE l'errore in #cloudErr, che
// vive dentro #cloudAccedi. Il tasto Google nella schermata "Registrati"
// (googleRegBtn) usa la stessa iniziaAccessoGoogle()/mostraErroreAccesso():
// se Supabase rispondeva con un errore (es. provider Google non abilitato,
// redirect non autorizzato...) mentre si era sulla schermata "Registrati",
// il messaggio finiva scritto in un elemento nascosto (#cloudAccedi ha
// display:none lì) — al tocco non succedeva visibilmente nulla. Ora
// mostraErroreAccesso() scrive in #regErr quando #cloudRegistra è la
// schermata attiva, in #cloudErr altrimenti.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('Google: un errore mentre si è su "Registrati" compare in #regErr (visibile), non solo nel nascosto #cloudErr', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    mostraCloudGate('registra');
    sb = { auth: { signInWithOAuth(){ return Promise.resolve({ error:{ message:'Unsupported provider: provider is not enabled' } }); } } };
    await iniziaAccessoGoogle();
  `);
  assert.equal(document.getElementById('cloudRegistra').style.display, 'block',
    'il test deve restare sulla schermata di registrazione');
  assert.equal(document.getElementById('regErr').style.display, 'block',
    'l\'errore deve comparire nella casella visibile della schermata Registrati');
  assert.notEqual(document.getElementById('regErr').textContent, '');
  window.close();
});

test('Google: un errore mentre si è su "Accedi" continua a comparire in #cloudErr, come prima', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    mostraCloudGate('accedi');
    sb = { auth: { signInWithOAuth(){ return Promise.resolve({ error:{ message:'Unsupported provider: provider is not enabled' } }); } } };
    await iniziaAccessoGoogle();
  `);
  assert.equal(document.getElementById('cloudAccedi').style.display, 'block');
  assert.equal(document.getElementById('cloudErr').style.display, 'block');
  assert.notEqual(document.getElementById('cloudErr').textContent, '');
  window.close();
});
