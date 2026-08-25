'use strict';
// Richiesta esplicita dell'utente (25/08/2026, diciassettesimo giro), con
// screenshot annotato a mano: su Storico l'intestazione legacy "Registro
// Allenamento"/"Caricamento..." (.sticky-top) e la card "Il mio Personal
// Trainer" (#cardMioPT) — entrambe condivise con Scheda/Registra/Dieta —
// non devono più comparire sopra il calendario: il calendario deve essere
// la prima cosa in vista. In più, i 3 tasti Allenamenti/Volume/Misure
// sempre in vista sono stati sostituiti da un menu a tendina compatto.
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

test('menu a tendina Storico: chiuso di default, mostra "Allenamenti" attivo, si apre al tocco', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.querySelector('#navTabsGlobale button[data-go="storico"]').click();
  `);
  assert.equal(document.getElementById('storicoMenu').classList.contains('show'), false);
  assert.match(document.getElementById('storicoMenuBtnLabel').textContent, /Allenamenti/);
  await run(window, `document.getElementById('storicoMenuBtn').click();`);
  assert.equal(document.getElementById('storicoMenu').classList.contains('show'), true);
  window.close();
});

test('menu a tendina Storico: scegliendo "Volume" cambia vista, aggiorna l\'etichetta e richiude il menu (niente più 3 tasti sempre in vista)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.querySelector('#navTabsGlobale button[data-go="storico"]').click();
    document.getElementById('storicoMenuBtn').click();
    document.querySelector('.seg-btn[data-seg2="volume"]').click();
  `);
  assert.match(document.getElementById('storicoMenuBtnLabel').textContent, /Volume/);
  assert.equal(document.getElementById('historyVolumeBlock').style.display, 'block');
  assert.equal(document.getElementById('historyLogsBlock').style.display, 'none');
  assert.equal(document.getElementById('storicoMenu').classList.contains('show'), false, 'il menu si richiude dopo la scelta');
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
