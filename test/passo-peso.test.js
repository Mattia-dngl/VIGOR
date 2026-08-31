'use strict';
// Feedback del 25/08/2026: il campo "kg" nella registrazione delle serie
// andava a scatti di 0.5 kg, che con la formula di Epley produceva record
// stimati con la virgola (es. 81.7 kg) mai davvero sollevati. Il passo era
// stato portato a 5 kg per risolverlo.
//
// Feedback del 31/08/2026 (terzo giro): passo:5 è un intero, e questo fa sì
// che i telefoni mostrino la tastiera numerica SENZA punto decimale (vedi
// buildFieldsHtml(), che sceglie inputmode="decimal" solo se passo < 1) —
// impossibile scrivere pesi reali come 15,5 o 17,5 kg (dischi da mezzo
// chilo). Richiesta esplicita: l'utente deve poter registrare QUALSIASI
// peso: è solo il numero CALCOLATO dall'app (il massimale stimato) che va
// arrotondato, non l'input. Il passo torna quindi a 0.5, e recordPersonale()/
// il grafico "Progressi per esercizio" ora arrotondano il risultato
// all'intero invece che al decimale, così niente più "81.7 kg" inventati.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('TIPI_MISURA: ogni campo "kg" ha passo 0.5, per poter scrivere pesi reali come 15,5 o 17,5', async () => {
  const { window } = await loadApp();
  const passi = await run(window, `
    return Object.values(TIPI_MISURA)
      .flatMap(def => def.campi.filter(c => c.chiave === 'kg').map(c => c.passo));
  `);
  assert.ok(passi.length >= 4, 'ci si aspettano almeno i 4 tipi di misura che includono un campo kg');
  assert.ok(passi.every(p => p === 0.5), 'tutti i campi "kg" devono avere passo 0.5, trovato: ' + JSON.stringify(passi));
  window.close();
});

test('Registra: il campo kg di un esercizio a peso ha step="0.5" e tastiera con la virgola (inputmode="decimal")', async () => {
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
  assert.equal(kgInput.step, '0.5');
  assert.equal(kgInput.inputMode, 'decimal', 'senza tastiera decimale non si può scrivere un peso come 15,5 su telefono');
  kgInput.value = '17.5';
  assert.equal(kgInput.value, '17.5', 'il campo deve accettare davvero un peso con la virgola, non solo mostrare lo step giusto');
  window.close();
});

test('recordPersonale: il massimale stimato (Epley) si arrotonda all\'intero, non più al decimale', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
      logs:[{ date:'2026-02-01', exercises:[{ name:'Panca Piana', sets:[{kg:'81.5', reps:'3'}] }] }]
    };
    // 81.5 * (1 + 3/30) = 89.65 -> prima diventava 89.7 (un decimale), ora 90 (intero)
    return recordPersonale(profilo, 'Panca Piana');
  `);
  assert.ok(r, 'deve trovare un record');
  assert.equal(r.valore, 90);
  assert.equal(Number.isInteger(r.valore), true, 'il valore mostrato non deve avere decimali');
  window.close();
});
