'use strict';
// 10/09/2026: trovato in produzione un profilo reale (creato senza passare
// da profiloVuotoPerCloud()/pt-area.js) con "programs" del tutto assente
// dai dati, non solo vuoto — a differenza di activeProgram() (già corretto
// in precedenza), altri punti che leggono prof.programs direttamente
// (scheda-editor.js: .find/.filter/.push, volume-muscolare.js: .find) non
// hanno nessun controllo e andavano in crash con "undefined is not an
// object (evaluating 'prof.programs.find')" appena si apriva Scheda o
// Storico con quel profilo. normalizzaProfilo() gira su ogni profilo
// caricato: è il punto giusto per garantire l'array una volta sola.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('normalizzaProfilo(): un profilo con "programs" del tutto assente (non solo vuoto) ottiene un array vuoto, non undefined', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = { id:'x', name:'X', email:'x@test.it' }; // niente "programs" né "activeProgramId"
    normalizzaProfilo(p);
    return { programs: p.programs, activeProgramId: p.activeProgramId };
  `);
  assert.deepEqual(r.programs, []);
  assert.equal(r.activeProgramId, null);
});

test('normalizzaProfilo(): un "programs" già valido non viene toccato', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = { id:'x', name:'X', email:'x@test.it', programs:[{id:'p1'}], activeProgramId:'p1' };
    normalizzaProfilo(p);
    return { programs: p.programs, activeProgramId: p.activeProgramId };
  `);
  assert.deepEqual(r.programs, [{id:'p1'}]);
  assert.equal(r.activeProgramId, 'p1');
});
