'use strict';
// Landing page (TASK 1, roadmap 07/09/2026): test sul rilevamento OS/webview
// social e sui tab Android/iPhone della sezione "Come si installa".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const { rilevaSistemaOperativo, rilevaWebviewSocial } = require('../js/landing.js');

function leggi(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

// Carica landing.html dentro jsdom con landing.js inline (niente rete) e uno
// user agent scelto dal test, così il rilevamento di default (quale tab si
// apre da solo) è verificabile.
function caricaLanding(userAgent){
  let html = leggi('landing.html');
  html = html.replace('<script src="js/landing.js"></script>', `<script>${leggi('js/landing.js')}</script>`);
  const dom = new JSDOM(html, {
    url: 'http://localhost/landing.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    resources: { userAgent }
  });
  return dom;
}

test('rilevaSistemaOperativo riconosce Android, iPhone e il resto', () => {
  assert.equal(rilevaSistemaOperativo('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'android');
  assert.equal(rilevaSistemaOperativo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'ios');
  assert.equal(rilevaSistemaOperativo('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'altro');
  assert.equal(rilevaSistemaOperativo(undefined), 'altro');
});

test('rilevaWebviewSocial riconosce i browser interni di Instagram/Facebook e simili', () => {
  assert.equal(rilevaWebviewSocial('Mozilla/5.0 (iPhone) Instagram 300.0.0'), true);
  assert.equal(rilevaWebviewSocial('Mozilla/5.0 (iPhone) FBAN/FBIOS'), true);
  assert.equal(rilevaWebviewSocial('Mozilla/5.0 (iPhone) Version/17.0 Safari/604.1'), false);
});

test('su Android si apre di default il tab Android', async () => {
  const dom = caricaLanding('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
  await new Promise(r => dom.window.document.addEventListener('DOMContentLoaded', r));
  const { document } = dom.window;
  assert.equal(document.getElementById('tabAndroid').getAttribute('aria-selected'), 'true');
  assert.equal(document.getElementById('pannelloAndroid').hidden, false);
  assert.equal(document.getElementById('pannelloIphone').hidden, true);
});

test('su iPhone si apre di default il tab iPhone', async () => {
  const dom = caricaLanding('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/604.1');
  await new Promise(r => dom.window.document.addEventListener('DOMContentLoaded', r));
  const { document } = dom.window;
  assert.equal(document.getElementById('tabIphone').getAttribute('aria-selected'), 'true');
  assert.equal(document.getElementById('pannelloIphone').hidden, false);
  assert.equal(document.getElementById('pannelloAndroid').hidden, true);
});

test('su iPhone dentro un browser social compare l\'avviso "apri in Safari"', async () => {
  const dom = caricaLanding('Mozilla/5.0 (iPhone) Instagram 300.0.0');
  await new Promise(r => dom.window.document.addEventListener('DOMContentLoaded', r));
  const { document } = dom.window;
  assert.ok(document.getElementById('installAvvisoSafari').classList.contains('mostra'));
});

test('su iPhone in Safari vero l\'avviso resta nascosto', async () => {
  const dom = caricaLanding('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/604.1');
  await new Promise(r => dom.window.document.addEventListener('DOMContentLoaded', r));
  const { document } = dom.window;
  assert.ok(!document.getElementById('installAvvisoSafari').classList.contains('mostra'));
});

test('cliccando il tab iPhone si passa da un pannello all\'altro', async () => {
  const dom = caricaLanding('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
  await new Promise(r => dom.window.document.addEventListener('DOMContentLoaded', r));
  const { document } = dom.window;
  document.getElementById('tabIphone').click();
  assert.equal(document.getElementById('tabIphone').getAttribute('aria-selected'), 'true');
  assert.equal(document.getElementById('tabAndroid').getAttribute('aria-selected'), 'false');
  assert.equal(document.getElementById('pannelloIphone').hidden, false);
  assert.equal(document.getElementById('pannelloAndroid').hidden, true);
});

test('le frecce da tastiera spostano il focus e la selezione tra i tab', async () => {
  const dom = caricaLanding('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
  await new Promise(r => dom.window.document.addEventListener('DOMContentLoaded', r));
  const { document, KeyboardEvent } = dom.window;
  const tabAndroid = document.getElementById('tabAndroid');
  tabAndroid.focus();
  tabAndroid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(document.getElementById('tabIphone').getAttribute('aria-selected'), 'true');
  assert.equal(document.activeElement, document.getElementById('tabIphone'));
});

test('la pagina linka privacy e termini nel footer', () => {
  const dom = caricaLanding('Mozilla/5.0');
  const { document } = dom.window;
  assert.ok(document.querySelector('footer a[href="privacy.html"]'));
  assert.ok(document.querySelector('footer a[href="termini.html"]'));
});
