'use strict';
// Feedback del 25/08/2026: dopo la registrazione, l'avviso "Account creato!
// Vai nella tua email..." usava i toni dell'accent (rosso/arancio) — lo
// stesso colore usato ovunque nell'app per gli errori (password errata,
// email non valida...). Su un esito POSITIVO sembrava quindi che qualcosa
// non fosse andato a buon fine. Ora questo banner ha una variante verde
// dedicata (.info-banner.esito-positivo).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./helpers/loadApp.js');

test('HTML: il banner "Account creato!" usa la variante verde, non i toni dell\'errore', async () => {
  const { window, document } = await loadApp();
  const banner = document.getElementById('confermaEmailBanner');
  assert.ok(banner.classList.contains('info-banner'));
  assert.ok(banner.classList.contains('esito-positivo'),
    'un messaggio di successo non deve avere lo stesso stile visivo di un errore');
  window.close();
});

test('CSS: .info-banner.esito-positivo usa il colore "ok" (verde), non l\'accent (rosso)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const regola = css.match(/\.info-banner\.esito-positivo\{[^}]*\}/);
  assert.ok(regola, 'la regola .info-banner.esito-positivo deve esistere');
  assert.match(regola[0], /var\(--ok\)|rgba\(31,177,95/, 'lo sfondo deve richiamare il verde di conferma, non il rosso');
});
