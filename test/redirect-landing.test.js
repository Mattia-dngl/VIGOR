'use strict';
// Landing page (TASK 1, feedback 07/09/2026 sul routing): index.html deve
// mandare i visitatori nuovi su landing.html, senza mai romperlo per chi ha
// già l'app installata, una sessione attiva, o arriva da un link di
// conferma email/recupero password.
const test = require('node:test');
const assert = require('node:assert/strict');
const { decidiRedirectLanding } = require('../js/ui/redirect-landing.js');

test('un visitatore nuovo, in un browser normale, va reindirizzato', () => {
  assert.equal(decidiRedirectLanding({ standalone: false, hash: '', search: '', chiaviLocalStorage: [] }), true);
});

test('chi ha già installato la PWA (standalone) non viene mai reindirizzato', () => {
  assert.equal(decidiRedirectLanding({ standalone: true, hash: '', search: '', chiaviLocalStorage: [] }), false);
});

test('un link di conferma email/recupero password non viene mai deviato sulla landing', () => {
  assert.equal(decidiRedirectLanding({ standalone: false, hash: '#access_token=xyz&type=recovery', search: '', chiaviLocalStorage: [] }), false);
  assert.equal(decidiRedirectLanding({ standalone: false, hash: '#type=recovery', search: '', chiaviLocalStorage: [] }), false);
  assert.equal(decidiRedirectLanding({ standalone: false, hash: '', search: '?code=abc123', chiaviLocalStorage: [] }), false);
});

test('un link che arriva dalla landing stessa (?app=1) non viene rimbalzato indietro', () => {
  assert.equal(decidiRedirectLanding({ standalone: false, hash: '', search: '?app=1', chiaviLocalStorage: [] }), false);
});

test('chi ha già dei dati locali dell\'app (non è un cliente nuovo) resta su index.html', () => {
  assert.equal(decidiRedirectLanding({ standalone: false, hash: '', search: '', chiaviLocalStorage: ['gymTrackerPersonaleState_v1'] }), false);
});

test('chi ha già una sessione Supabase salvata (sb-*-auth-token) resta su index.html', () => {
  assert.equal(decidiRedirectLanding({ standalone: false, hash: '', search: '', chiaviLocalStorage: ['sb-abcxyz-auth-token'] }), false);
});
