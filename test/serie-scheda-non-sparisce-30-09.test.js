'use strict';
// 30/09/2026: le schede perdevano da sole le serie. normalizzaProfilo() (11/09)
// trattava "sets" degli esercizi di una scheda come quello dei log (array) e
// sostituiva il numero di serie con [] a ogni caricamento del profilo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('normalizzaProfilo(): il numero di serie di una scheda resta intatto', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = { id:'x', name:'X', email:'x@test.it', activeProgramId:'p1',
      programs:[{id:'p1', days:[{key:'A', exercises:[{name:'Panca', sets:4, reps:'8'}, {name:'Curl', sets:3, reps:'10'}]}]}] };
    normalizzaProfilo(p);
    return p.programs[0].days[0].exercises.map(e=>e.sets);
  `);
  assert.deepEqual(r, [4, 3]);
});

test('normalizzaProfilo(): una scheda già danneggiata (sets = []) recupera le serie dall\'ultimo allenamento, altrimenti 3', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = { id:'x', name:'X', email:'x@test.it', activeProgramId:'p1',
      programs:[{id:'p1', days:[{key:'A', exercises:[{name:'Panca', sets:[], reps:'8'}, {name:'Curl', sets:[], reps:'10'}]}]}],
      logs:[{id:'l1', status:'registrato', exercises:[{name:'Panca', sets:[{},{},{},{}]}]}] };
    normalizzaProfilo(p);
    return p.programs[0].days[0].exercises.map(e=>e.sets);
  `);
  assert.deepEqual(r, [4, 3]);
});

test('normalizzaProfilo(): i log continuano ad avere "sets" come array', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = { id:'x', name:'X', email:'x@test.it', logs:[{id:'l1', exercises:[{name:'Panca'}]}] };
    normalizzaProfilo(p);
    return Array.isArray(p.logs[0].exercises[0].sets);
  `);
  assert.equal(r, true);
});
