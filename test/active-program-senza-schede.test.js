'use strict';
// 10/09/2026: segnalato dall'utente uno schermo bianco con "Promise non
// gestita" in activeProgram() chiamata da renderMioPT(). Causa: un cliente
// senza nessuna scheda ha programs:[] — activeProgram() faceva
// programs[programs.length-1].id, cioè programs[-1].id, che lancia un
// TypeError. Essendo renderMioPT() async e chiamata senza await/catch, il
// TypeError diventava una promise rifiutata non gestita e la pagina si
// rompeva. activeProgram() ora torna null se non ci sono schede.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloSenzaSchede(){
  return {
    id:'io', name:'Io', email:'io@test.it', createdAt:'2026-01-01', logs:[], measurements:[],
    customExercises:{}, customFoods:{}, mealLogs:[], waterLogs:[],
    programs:[], activeProgramId:null
  };
}

test('activeProgram(): con programs vuoto torna null invece di lanciare (programs[-1].id)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloSenzaSchede())};
    state.profiles = [profilo]; activeProfileId = 'io';
    return activeProgram();
  `);
  assert.equal(r, null);
  window.close();
});
