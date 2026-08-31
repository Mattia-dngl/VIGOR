'use strict';
// 31/08/2026: segnalato dall'utente che la barra "Settimana X di Y" nella
// Scheda non funzionava. Causa: comparivano tre campi (durata in settimane,
// data di inizio, scadenza) ma la barra richiedeva che DUE di questi fossero
// impostati (durata + data di inizio) — chi compilava solo la durata (il
// caso più comune) non la vedeva mai comparire, senza alcun errore visibile.
// Ora resta solo il campo durata: data di inizio e scadenza si calcolano da
// sole, quindi la barra compare sempre appena si imposta la durata.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(){
  return {
    id:'io', name:'Io', email:'io@test.it', createdAt:'2026-01-01', logs:[], measurements:[],
    customExercises:{}, customFoods:{}, mealLogs:[], waterLogs:[],
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      durataSettimane:null, dataInizio:null, notePT:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId:'p1'
  };
}

test('Scheda: impostare solo la durata (senza toccare altri campi) basta a far comparire "Settimana X di Y"', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    renderNewProgramForm();
    document.getElementById('newProgramDurata').value = '8';
    document.getElementById('updateProgramBtn').click();
  `);
  const html = document.getElementById('programView').innerHTML;
  assert.match(html, /Settimana \d+ di 8/, 'la barra di avanzamento deve comparire con la sola durata impostata');
  assert.match(html, /scheda-progress-fill/);
  window.close();
});

test('Scheda: senza durata impostata la barra resta assente, nessun numero inventato', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
  `);
  const html = document.getElementById('programView').innerHTML;
  assert.doesNotMatch(html, /Settimana \d+ di/);
  window.close();
});

test('Scheda: la scadenza calcolata si vede anche nel riepilogo (nessun campo separato da compilare)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    renderNewProgramForm();
    document.getElementById('newProgramDurata').value = '4';
    document.getElementById('updateProgramBtn').click();
    return activeProgram().scadenza;
  `);
  const r = await run(window, `return activeProgram().scadenza;`);
  const atteso = new Date('2026-01-01T00:00:00'); atteso.setDate(atteso.getDate() + 4*7);
  assert.equal(r, atteso.toISOString().slice(0,10));
  window.close();
});
