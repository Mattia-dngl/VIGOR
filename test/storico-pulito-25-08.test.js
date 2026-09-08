'use strict';
// Richiesta esplicita dell'utente (25/08/2026, diciassettesimo giro), con
// screenshot annotato a mano: su Storico l'intestazione legacy "Registro
// Allenamento"/"Caricamento..." (.sticky-top) e la card "Il mio Personal
// Trainer" (#cardMioPT) — entrambe condivise con Scheda/Registra/Dieta —
// non devono più comparire sopra il calendario: il calendario deve essere
// la prima cosa in vista. I 3 tasti Allenamenti/Volume/Misure erano poi
// diventati un menu a tendina compatto, e dall'08/09/2026 sono tornati
// schede sempre visibili (richiesta esplicita, redesign Storico).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(){
  return {
    id: 'io', name: 'Io', email: 'io@test.it', logs: [], measurements: [], customExercises: {}, customFoods: {},
    programs: [{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId: 'p1', mealLogs: []
  };
}

test('apriStorico() nasconde l\'intestazione legacy e la card "Il mio Personal Trainer": il calendario resta la prima cosa in vista', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.querySelector('#navTabsGlobale button[data-go="storico"]').click();
  `);
  assert.equal(document.querySelector('.sticky-top').style.display, 'none', 'intestazione legacy nascosta su Storico');
  assert.equal(document.getElementById('cardMioPT').style.display, 'none', 'card PT nascosta su Storico');
  window.close();
});

test('tornando su Scheda (o un\'altra vista) dopo Storico, intestazione e card PT tornano visibili', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.querySelector('#navTabsGlobale button[data-go="storico"]').click();
    document.querySelector('#navTabsGlobale button[data-go="program"]').click();
  `);
  assert.notEqual(document.querySelector('.sticky-top').style.display, 'none', 'intestazione torna visibile lasciando Storico');
  window.close();
});

test('schede Storico: sempre visibili (niente più menu a tendina), "Allenamenti" attiva di default', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.querySelector('#navTabsGlobale button[data-go="storico"]').click();
  `);
  const tabs = document.querySelectorAll('.seg-toggle .seg-btn[data-seg2]');
  assert.equal(tabs.length, 3, 'le 3 schede Allenamenti/Volume/Misure sono sempre nel markup, non dentro un menu');
  assert.ok(document.querySelector('.seg-btn[data-seg2="allenamenti"]').classList.contains('active'));
  window.close();
});

test('schede Storico: scegliendo "Volume" cambia vista subito, senza menu da aprire prima', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.querySelector('#navTabsGlobale button[data-go="storico"]').click();
    document.querySelector('.seg-btn[data-seg2="volume"]').click();
  `);
  assert.ok(document.querySelector('.seg-btn[data-seg2="volume"]').classList.contains('active'));
  assert.equal(document.getElementById('historyVolumeBlock').style.display, 'block');
  assert.equal(document.getElementById('historyLogsBlock').style.display, 'none');
  window.close();
});

test('Storico: il calendario è la prima cosa nel blocco (prima di Misure/Volume nel markup)', async () => {
  const { window, document } = await loadApp();
  const figli = Array.from(document.getElementById('programStoricoBlock').children);
  const logsIdx = figli.findIndex(el => el.id === 'historyLogsBlock');
  const misureIdx = figli.findIndex(el => el.id === 'historyMisureBlock');
  const volumeIdx = figli.findIndex(el => el.id === 'historyVolumeBlock');
  assert.ok(logsIdx >= 0 && logsIdx < misureIdx && logsIdx < volumeIdx);
  window.close();
});
