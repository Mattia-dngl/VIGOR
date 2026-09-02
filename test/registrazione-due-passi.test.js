'use strict';
// Richiesta esplicita dell'utente (proposte di miglioramento, 01/09/2026):
// "Registrati" (account online) in due passi — prima solo l'email, poi nome
// e password — invece dei tre campi tutti insieme.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('aprendo "Registrati" si vede solo il passo 1 (email), il passo 2 è nascosto', async () => {
  const { window, document } = await loadApp();
  await run(window, `mostraCloudGate('registra');`);
  assert.equal(document.getElementById('regStep1').style.display, 'block');
  assert.equal(document.getElementById('regStep2').style.display, 'none');
});

test('"Continua" con un\'email non valida mostra l\'errore e resta al passo 1', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    mostraCloudGate('registra');
    document.getElementById('regEmail').value = 'non-e-una-email';
    document.getElementById('regContinuaBtn').click();
  `);
  assert.equal(document.getElementById('regStep2').style.display, 'none');
  assert.equal(document.getElementById('regErr').style.display, 'block');
  assert.match(document.getElementById('regErr').textContent, /email valida/);
});

test('"Continua" con un\'email valida passa al passo 2 (nome+password), senza perdere l\'email', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    mostraCloudGate('registra');
    document.getElementById('regEmail').value = 'prova@test.it';
    document.getElementById('regContinuaBtn').click();
  `);
  assert.equal(document.getElementById('regStep1').style.display, 'none');
  assert.equal(document.getElementById('regStep2').style.display, 'block');
  assert.equal(document.getElementById('regEmail').value, 'prova@test.it');
});

test('"← Cambia email" torna al passo 1 mantenendo il valore già scritto', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    mostraCloudGate('registra');
    document.getElementById('regEmail').value = 'prova@test.it';
    document.getElementById('regContinuaBtn').click();
    document.getElementById('regTornaEmailBtn').click();
  `);
  assert.equal(document.getElementById('regStep1').style.display, 'block');
  assert.equal(document.getElementById('regStep2').style.display, 'none');
  assert.equal(document.getElementById('regEmail').value, 'prova@test.it');
});

test('riaprendo "Registrati" da capo (es. dopo Accedi) si riparte sempre dal passo 1, vuoto', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    mostraCloudGate('registra');
    document.getElementById('regEmail').value = 'vecchia@test.it';
    document.getElementById('regContinuaBtn').click();
    mostraCloudGate('accedi');
    mostraCloudGate('registra');
  `);
  assert.equal(document.getElementById('regStep1').style.display, 'block');
  assert.equal(document.getElementById('regStep2').style.display, 'none');
  assert.equal(document.getElementById('regEmail').value, '');
});

test('il tasto "Registrati" (passo 2) continua a validare nome e password come prima e a chiamare signUp', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    mostraCloudGate('registra');
    document.getElementById('regEmail').value = 'prova@test.it';
    document.getElementById('regContinuaBtn').click();
    document.getElementById('regNome').value = '';
    document.getElementById('regPw').value = 'passwordLunga1';
    document.getElementById('regBtn').click();
    const erroreNomeVisibile = document.getElementById('regErr').style.display;
    const testoErroreNome = document.getElementById('regErr').textContent;

    let chiamatoConEmail = null;
    sb = { auth: { signUp(opz){ chiamatoConEmail = opz.email; return Promise.resolve({ data:{ session:{} , user:{ id:'u1', email: opz.email } }, error:null }); } } };
    dopoAccessoOnline = async function(){};
    document.getElementById('regNome').value = 'Prova';
    document.getElementById('regPw').value = '1234567';
    document.getElementById('regBtn').click();
    const erroreCortaVisibile = document.getElementById('regErr').style.display;

    document.getElementById('regPw').value = 'passwordLunga1';
    await document.getElementById('regBtn').click();
    await new Promise(res=>setTimeout(res, 0));
    return { erroreNomeVisibile, testoErroreNome, erroreCortaVisibile, chiamatoConEmail };
  `);
  assert.equal(r.erroreNomeVisibile, 'block');
  assert.match(r.testoErroreNome, /nome/);
  assert.equal(r.erroreCortaVisibile, 'block', 'la password troppo corta deve continuare a essere rifiutata');
  assert.equal(r.chiamatoConEmail, 'prova@test.it', 'signUp deve ricevere l\'email inserita al passo 1');
});
