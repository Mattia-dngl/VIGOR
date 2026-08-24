'use strict';
// Test del fabbisogno calorico e del calcolo dell'età dalla data di nascita
// (vedi index.html, sezione "FABBISOGNO CALORICO" e newProfile/onboarding).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('calcolaEta: calcola gli anni compiuti da una data di nascita', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const oggi = new Date();
    const y = oggi.getFullYear();
    const m = String(oggi.getMonth()+1).padStart(2,'0');
    const d = String(oggi.getDate()).padStart(2,'0');
    // esattamente 30 anni fa, oggi: deve dare 30 (compleanno già passato/oggi)
    const trentenne = calcolaEta((y-30) + '-' + m + '-' + d);
    // nato ieri di 30 anni fa più un giorno: il compleanno di quest'anno non è
    // ancora arrivato, quindi deve darne 29
    const domani = new Date(oggi.getTime() + 86400000);
    const m2 = String(domani.getMonth()+1).padStart(2,'0');
    const d2 = String(domani.getDate()).padStart(2,'0');
    const nonAncora = calcolaEta((y-30) + '-' + m2 + '-' + d2);
    return { trentenne, nonAncora, vuoto: calcolaEta(null), invalida: calcolaEta('non-una-data') };
  `);
  assert.equal(r.trentenne, 30);
  assert.equal(r.nonAncora, 29);
  assert.equal(r.vuoto, null);
  assert.equal(r.invalida, null);
  window.close();
});

test('etaProfilo: preferisce la data di nascita, ma usa il vecchio campo età come ripiego', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const oggi = new Date();
    const y = oggi.getFullYear();
    const dataNascita25anni = (y-25) + '-01-01';
    return {
      conData: etaProfilo({dataNascita: dataNascita25anni, eta: 99}),   // la data vince sul vecchio valore
      soloLegacy: etaProfilo({dataNascita: null, eta: 40}),             // senza data, usa il vecchio valore
      nessunDato: etaProfilo({dataNascita: null, eta: null}),
      profiloNullo: etaProfilo(null)
    };
  `);
  assert.ok(r.conData === 24 || r.conData === 25); // dipende dal giorno dell'anno in cui gira il test
  assert.equal(r.soloLegacy, 40);
  assert.equal(r.nessunDato, null);
  assert.equal(r.profiloNullo, null);
  window.close();
});

test('calcolaFabbisogno: segnala "data di nascita" tra i dati mancanti, non più "età"', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return calcolaFabbisogno({ sesso:'uomo', dataNascita:null, eta:null, altezza:180, measurements:[] });
  `);
  assert.ok(r.mancanti.includes('data di nascita'));
  assert.ok(!r.mancanti.includes('età'));
  window.close();
});

test('calcolaFabbisogno: con tutti i dati calcola BMR/TDEE con Mifflin-St Jeor', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const oggi = new Date();
    const y = oggi.getFullYear();
    const prof = {
      sesso:'uomo', dataNascita:(y-30)+'-06-15', altezza:180,
      livelloAttivita:'moderato', obiettivoCalorico:'mantenimento',
      measurements:[{date:'2026-01-01', weight:80}]
    };
    return calcolaFabbisogno(prof);
  `);
  assert.equal(r.mancanti.length, 0);
  // BMR = 10*80 + 6.25*180 - 5*eta + 5 (uomo) — eta dipende dal giorno del test,
  // quindi verifico solo che il numero sia in un range sensato invece di
  // hardcodare l'età esatta.
  assert.ok(r.bmr > 1600 && r.bmr < 1850, `bmr fuori range: ${r.bmr}`);
  assert.equal(r.tdee, Math.round(r.bmr * 1.55));
  assert.equal(r.risultato, r.tdee); // obiettivo "mantenimento" = ×1
  window.close();
});
