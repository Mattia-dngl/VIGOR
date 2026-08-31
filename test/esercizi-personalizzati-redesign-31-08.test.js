'use strict';
// 31/08/2026: "I tuoi esercizi personalizzati" segnalata come "poco gradevole
// e poco curata" — riutilizzava .exercise-edit-row (pensato per i campi di un
// set) con link/emoji sparsi senza gerarchia. Ridisegnata come scheda
// compatta (.my-ex-item) con divisorio, muscoli come chip di sola lettura e
// le azioni allineate sulla stessa riga.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, run } = require('./helpers/loadApp');

const PROFILO_CON_ESERCIZI = `{
  id: 'io', name: 'Io', email: 'io@test.it', logs: [], measurements: [],
  customExercises: {
    'squat': { muscles: ['quad'], video: '' },
    'panca romana': { muscles: [], video: 'https://youtube.com/x' }
  },
  customFoods: {}, mealLogs: [], waterLogs: [],
  programs: [], activeProgramId: null
}`;

test('CSS: la scheda di un esercizio personalizzato ha un divisorio e non più la griglia a 3 colonne dei set', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.match(css, /\.my-ex-item\{padding:12px 0; border-bottom:1px solid var\(--border\);\}/);
  assert.match(css, /\.my-ex-head\{display:flex; justify-content:space-between; align-items:center;/);
});

test('esercizi personalizzati: il nome non ha più l\'emoji ✏️ davanti a "Modifica muscoli" e i muscoli sono chip, non testo unito da virgole', async () => {
  const { window, document } = await loadApp();
  try{
    await run(window, `
      state.profiles = [${PROFILO_CON_ESERCIZI}];
      activeProfileId = 'io';
      renderCustomExList();
    `);
    const wrap = document.getElementById('customExList');
    assert.equal(wrap.querySelectorAll('.my-ex-item').length, 2);
    assert.ok(!wrap.innerHTML.includes('✏️'), 'niente più emoji davanti a "Modifica muscoli"');
    const primo = wrap.querySelector('.my-ex-item');
    assert.ok(primo.querySelector('.my-ex-name').textContent.length > 0);
    assert.ok(primo.querySelector('.my-ex-muscles .muscle-chip'), 'i muscoli sono mostrati come chip');
    assert.ok(primo.querySelector('.mio-ex-modifica-muscoli'));
    assert.ok(primo.querySelector('.my-ex-tipo-select'));
  } finally {
    window.close();
  }
});
