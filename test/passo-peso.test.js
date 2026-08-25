'use strict';
// Feedback del 25/08/2026: il campo "kg" nella registrazione delle serie
// andava a scatti di 0.5 kg, che con la formula di Epley produceva record
// stimati con la virgola (es. 81.7 kg) mai davvero sollevati. Ora il passo
// è di 5 kg, come i carichi reali in palestra.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('TIPI_MISURA: ogni campo "kg" ha passo 5 (non più 0.5)', async () => {
  const { window } = await loadApp();
  const passi = await run(window, `
    return Object.values(TIPI_MISURA)
      .flatMap(def => def.campi.filter(c => c.chiave === 'kg').map(c => c.passo));
  `);
  assert.ok(passi.length >= 4, 'ci si aspettano almeno i 4 tipi di misura che includono un campo kg');
  assert.ok(passi.every(p => p === 5), 'tutti i campi "kg" devono avere passo 5, trovato: ' + JSON.stringify(passi));
  window.close();
});

test('Registra: il campo kg di un esercizio a peso ha davvero step="5" nell\'input', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{},
      programs: [{ id:'p1', days:[{
        key:'A', name:'Petto', weekday:'Lunedì',
        exercises:[{ name:'Panca Piana', sets:1, reps:'5', muscles:['Petto'] }]
      }] }], activeProgramId:'p1'
    };
    state.profiles = [profilo]; activeProfileId = 'io';
    logDateInput.value = '2026-02-01';
    selectDay('A');
  `);
  const kgInput = document.querySelector('.exercise-block input[data-ex="Panca Piana"][data-idx="0"][data-field="kg"]');
  assert.ok(kgInput, 'il campo kg deve esistere');
  assert.equal(kgInput.step, '5');
  window.close();
});
