'use strict';
// Feedback del 25/08/2026 dagli screenshot: l'indicatore in basso a destra
// ("sincronizzato" / "salvo appena torna la rete") restava sempre visibile,
// coprendo la card "Area Personal Trainer" e la barra in basso. Ora:
//  - "sincronizzato" è solo una conferma, quindi sparisce da solo dopo un attimo
//  - "offline"/"sincronizzo" restano finché la situazione non cambia davvero
//    (l'utente potrebbe voler sapere che i dati non sono ancora salvati)
//  - la card è anche più piccola (meno padding, testo più piccolo)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('"sincronizzato" (stato ok) sparisce da solo dopo un paio di secondi', async () => {
  const { window, document } = await loadApp();
  // in test l'app parte sempre in modalità locale/offline (APP_CONFIG vuoto):
  // per verificare il comportamento della card forzo modalitaOnline() a true,
  // esattamente come farebbe l'app quando Supabase è configurato davvero.
  await run(window, `
    window.modalitaOnline = () => true;
    mostraStatoSync('ok', 'sincronizzato');
  `);
  const el = document.getElementById('cloudStato');
  assert.ok(el.classList.contains('show'), 'appena chiamato deve comparire');

  await new Promise(res => setTimeout(res, 2500));
  assert.ok(!el.classList.contains('show'), 'dopo un paio di secondi "sincronizzato" deve sparire da solo, senza coprire i contenuti per sempre');
  window.close();
});

test('"offline" (salvo appena torna la rete) NON sparisce da solo: resta finché la situazione non cambia', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    window.modalitaOnline = () => true;
    mostraStatoSync('offline', 'salvo appena torna la rete');
  `);
  const el = document.getElementById('cloudStato');
  assert.ok(el.classList.contains('show'));

  await new Promise(res => setTimeout(res, 2500));
  assert.ok(el.classList.contains('show'), '"offline" è un avviso utile (dati non ancora salvati): non deve sparire da solo');
  window.close();
});

test('chiamare di nuovo mostraStatoSync prima che scada il timer precedente non fa sparire lo stato nuovo per sbaglio', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    window.modalitaOnline = () => true;
    mostraStatoSync('ok', 'sincronizzato');
  `);
  // subito dopo (prima dei ~2.2s del timer di "ok") arriva un nuovo stato offline:
  await run(window, `mostraStatoSync('offline', 'salvo appena torna la rete');`);
  const el = document.getElementById('cloudStato');

  await new Promise(res => setTimeout(res, 2500));
  assert.ok(el.classList.contains('show'), 'il vecchio timer di "ok" non deve nascondere lo stato "offline" arrivato dopo');
  assert.equal(document.getElementById('cloudStatoTxt').textContent, 'salvo appena torna la rete');
  window.close();
});

test('CSS: la card dell\'indicatore è più compatta di prima', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const regola = css.match(/\.cloud-stato\{[^}]*\}/);
  assert.ok(regola, 'la regola .cloud-stato deve esistere');
  assert.match(regola[0], /font-size:10px/, 'testo più piccolo di prima (era 11.5px)');
  assert.match(regola[0], /padding:5px 11px/, 'padding più piccolo di prima (era 7px 14px)');
});
