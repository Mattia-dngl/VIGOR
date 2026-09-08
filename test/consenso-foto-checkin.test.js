'use strict';
// Task 5 (roadmap, 07/09/2026): consenso esplicito e separato per le foto
// di check-in (dato ex art. 9 GDPR, vedi privacy.html §6). Chiesto una
// volta sola, alla prima foto — non a ogni check-in — e mai come
// condizione per usare il resto dell'app.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(overrides){
  return Object.assign({
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], checkins:[],
    customExercises:{}, customFoods:{}, mealLogs:[], waterLogs:[], consensoFotoDataIl: null
  }, overrides||{});
}

// jsdom non permette di assegnare input.files direttamente (è read-only sul
// vero DOM): lo si aggira ridefinendo la proprietà sull'elemento, pattern
// standard per testare input[type=file] in jsdom.
async function scegliFile(window, document){
  await run(window, `
    apriCheckinCompilazione();
    const input = document.getElementById('checkinFotoFile');
    const file = new File(['contenuto-finto'], 'foto.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  `);
}

test('prima foto mai caricata prima: compare la richiesta di consenso', async () => {
  const { window, document } = await loadApp();
  await run(window, `state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';`);
  await scegliFile(window, document);
  assert.ok(document.querySelector('.custom-confirm-overlay'), 'deve comparire il dialogo di consenso');
  assert.match(document.querySelector('.custom-confirm-box p').textContent, /consenso esplicito/);
  window.close();
});

test('accettando il consenso: viene salvato e la foto passa alla lettura (elaboraFotoCheckin)', async () => {
  // jsdom non decodifica davvero le immagini (Image.onload non parte per un
  // data: URL sintetico): qui si verifica che il consenso sblocchi il passo
  // successivo (chiamata a elaboraFotoCheckin col file giusto), non l'esito
  // finale del canvas — quella pipeline è già coperta (con _checkinFotoDataUrl
  // impostato a mano) dagli altri test di checkin-cliente.
  const { window, document } = await loadApp();
  await run(window, `state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';`);
  await run(window, `
    window._elaboraChiamataCon = null;
    const originale = elaboraFotoCheckin;
    elaboraFotoCheckin = function(file){ window._elaboraChiamataCon = file.name; };
  `);
  await scegliFile(window, document);
  document.getElementById('customConfirmOk').click();
  const r = await run(window, `return { consenso: activeProfile().consensoFotoDataIl, chiamataCon: window._elaboraChiamataCon };`);
  assert.ok(r.consenso, 'il consenso deve essere salvato con una data');
  assert.equal(r.chiamataCon, 'foto.jpg');
  window.close();
});

test('rifiutando il consenso: la foto NON si carica, nessun consenso salvato', async () => {
  const { window, document } = await loadApp();
  await run(window, `state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';`);
  await scegliFile(window, document);
  document.getElementById('customConfirmCancel').click();
  const r = await run(window, `return { consenso: activeProfile().consensoFotoDataIl, haFoto: !!_checkinFotoDataUrl };`);
  assert.equal(r.consenso, null);
  assert.equal(r.haFoto, false);
  window.close();
});

test('rifiutare il consenso non impedisce di inviare il resto del check-in (peso/nota/sensazione)', async () => {
  const { window, document } = await loadApp();
  await run(window, `state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';`);
  await scegliFile(window, document);
  document.getElementById('customConfirmCancel').click();
  await run(window, `
    document.getElementById('checkinPeso').value = '80';
    document.getElementById('checkinInviaBtn').click();
  `);
  const r = await run(window, `return activeProfile().checkins;`);
  assert.equal(r.length, 1);
  assert.equal(r[0].peso, 80);
  assert.equal(r[0].fotoPath, null);
  window.close();
});

test('consenso già dato in precedenza: nessun dialogo, si passa subito alla lettura del file', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase({ consensoFotoDataIl: '2026-09-01T10:00:00.000Z' }))}];
    activeProfileId = 'io';
    window._elaboraChiamataCon = null;
    elaboraFotoCheckin = function(file){ window._elaboraChiamataCon = file.name; };
  `);
  await scegliFile(window, document);
  const r = await run(window, `return { dialogoPresente: !!document.querySelector('.custom-confirm-overlay'), chiamataCon: window._elaboraChiamataCon };`);
  assert.equal(r.dialogoPresente, false);
  assert.equal(r.chiamataCon, 'foto.jpg');
  window.close();
});
