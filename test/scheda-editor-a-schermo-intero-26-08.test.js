'use strict';
// Feedback su due screenshot con cerchi rossi/blu (26/08/2026, correzione al
// diciottesimo giro): la vista compatta era "troppo attaccato" (spaziatura
// insufficiente fra intestazione/pulsante "Registra" e la lista esercizi),
// e l'editor "un giorno alla volta" non bastava — un giorno aperto restava
// comunque dentro "tutto insieme" (intestazione legacy, card PT, nav in
// basso ancora in vista). Richiesta esplicita: aprendo un giorno per
// modificarlo deve vedersi SOLO quel giorno (niente intestazione/nav sopra),
// e lo stesso per "Modifica scheda"/"Nuova scheda" in generale.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(){
  return {
    id: 'io', name: 'Io', email: 'io@test.it', logs: [], measurements: [], customExercises: {}, customFoods: {}, mealLogs: [],
    programs: [{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      durataSettimane:null, dataInizio:null, notePT:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null, exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId: 'p1'
  };
}

test('entrando in "Modifica scheda" si nascondono intestazione legacy, card PT e nav in basso', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
  `);
  assert.notEqual(document.querySelector('.sticky-top').style.display, 'none', 'prima di modificare, l\'intestazione resta visibile');
  assert.equal(document.body.classList.contains('scheda-editor-aperto'), false);

  await run(window, `document.getElementById('schedaEditBtn').click();`);
  assert.equal(document.querySelector('.sticky-top').style.display, 'none', 'entrando in Modifica scheda, l\'intestazione legacy sparisce');
  assert.equal(document.getElementById('cardMioPT').style.display, 'none', 'anche la card PT sparisce');
  assert.equal(document.body.classList.contains('scheda-editor-aperto'), true, 'la classe che nasconde la nav in basso è attiva');

  await run(window, `document.getElementById('schedaTornaVediBtn').click();`);
  assert.notEqual(document.querySelector('.sticky-top').style.display, 'none', 'tornando a "Vedi", l\'intestazione riappare');
  assert.equal(document.body.classList.contains('scheda-editor-aperto'), false, 'la classe torna via');
  window.close();
});

test('tornare su Scheda da un\'altra schermata (es. Dieta) con l\'editor ancora aperto tiene nascosta l\'intestazione', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('schedaEditBtn').click();
    vaiA('dieta');
  `);
  await run(window, `vaiA('program');`);
  assert.equal(document.querySelector('.sticky-top').style.display, 'none', 'l\'editor era ancora aperto: l\'intestazione deve restare nascosta anche rientrando da un\'altra scheda');
  window.close();
});

test('renderDayEditors(): ogni riepilogo giorno ha sia l\'icona a freccina (chiusa) sia quella a × (aperta)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null, exercises:[] }];
    renderDayEditors();
  `);
  const chev = document.querySelector('#dayEditors .day-accordion .day-accordion-chev');
  assert.ok(chev.querySelector('.day-accordion-apri'), 'deve esserci l\'icona a freccina per lo stato chiuso');
  assert.ok(chev.querySelector('.day-accordion-chiudi'), 'deve esserci l\'icona a × per lo stato aperto a schermo intero');
  window.close();
});

test('CSS: un giorno aperto (.day-accordion[open]) copre tutto lo schermo, la nav in basso sparisce con Modifica scheda, la vista compatta ha più respiro', async () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.match(css, /\.day-accordion\[open\]\{[^}]*position:fixed;[^}]*inset:0;/, 'un giorno aperto deve diventare un overlay a schermo intero');
  assert.match(css, /body\.scheda-editor-aperto #navTabsGlobale\{display:none !important;\}/, 'la nav in basso deve sparire mentre si modifica la scheda');
  assert.match(css, /\.day-view-body\{padding:14px 15px 18px;\}/, 'più respiro sopra la lista esercizi in vista (era troppo attaccato)');
});
