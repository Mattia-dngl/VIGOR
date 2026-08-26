'use strict';
// Feedback dell'utente (26/08/2026, con screenshot annotato): la schermata
// "Registra" aveva troppa roba intorno mentre si registra un allenamento
// (intestazione condivisa "Registro Allenamento" + nome profilo/scheda,
// cerchiata in blu) — richiesta esplicita: "tutto ciò che si apre deve
// essere una pagina a sé [...] senza quello che ti ho cerchiato in blu e
// metti solo un tasto per tornare alla scheda". Stessa richiesta ha chiesto
// anche di rivedere la lista compatta "che giorno hai fatto?" (cerchiata in
// giallo), ispirandosi ad altre app di allenamento (Strong/Hevy/Lyfta,
// ricerca fatta prima di implementare: quelle app tengono la schermata di
// logging essenziale, con la selezione del giorno in una fascia compatta).
//
// Fix: Registra ha ora una propria intestazione (freccia indietro + titolo,
// stesso pattern già usato per "Modifica scheda" al 18°/19° giro) al posto
// di quella condivisa (.sticky-top, ora nascosta mentre si è su Registra,
// stessa nav anche nascosta — body.registra-aperto) — l'unico modo per
// uscire da qui è il bottone dedicato #registraTornaSchedaBtn. I pulsanti
// "che giorno hai fatto?" (#dayChoiceChips) sono passati da una colonna
// impilata a una fila orizzontale scorrevole, molto più compatta.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(){
  return {
    id: 'io', name: 'Io', email: 'io@test.it', logs: [], measurements: [], customExercises: {}, customFoods: {},
    programs: [{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId: 'p1', mealLogs: []
  };
}

test('apriRegistra(): nasconde l\'intestazione condivisa e la nav in basso, mostra il tasto dedicato per tornare alla scheda', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
  `);
  assert.equal(document.body.classList.contains('registra-aperto'), true, 'la classe che nasconde nav/intestazione deve essere attiva');
  assert.equal(document.querySelector('.sticky-top').style.display, 'none', 'l\'intestazione condivisa deve sparire');
  const btn = document.getElementById('registraTornaSchedaBtn');
  assert.ok(btn, 'deve esistere un bottone dedicato per tornare alla scheda');
  assert.ok(document.getElementById('view-log').contains(btn), 'il bottone vive dentro la vista Registra, non nell\'intestazione condivisa');
  window.close();
});

test('tasto "torna alla scheda": chiude la pagina a sé di Registra e riporta su Scheda con intestazione/nav ripristinate', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('registraTornaSchedaBtn').click();
  `);
  assert.equal(document.body.classList.contains('registra-aperto'), false, 'la classe deve sparire tornando alla scheda');
  assert.equal(document.querySelector('.sticky-top').style.display, '', 'l\'intestazione condivisa deve ricomparire');
  assert.ok(document.getElementById('view-program').classList.contains('active'), 'deve tornare sulla vista Scheda');
  window.close();
});

test('aprire Registra dal puntino della settimana (in Scheda) nasconde comunque intestazione/nav, non solo dal bottone "+"', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    renderHeader();
    const prima = document.body.classList.contains('registra-aperto');
    document.querySelector('#weekPulse .day').click();
    const dopo = document.body.classList.contains('registra-aperto');
    return { prima, dopo };
  `);
  assert.equal(r.prima, false);
  assert.equal(r.dopo, true, 'anche passando da un puntino della settimana, Registra deve diventare una pagina a sé');
  window.close();
});

test('CSS: la nav in basso sparisce con body.registra-aperto', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.match(css, /body\.registra-aperto #navTabsGlobale\{display:none !important;\}/);
});

test('CSS: le scelte "che giorno hai fatto?" sono una fila orizzontale scorrevole, non più una colonna impilata', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const blocco = css.slice(css.indexOf('#dayChoiceChips{'));
  assert.match(blocco, /#dayChoiceChips\{[^}]*flex-wrap:nowrap;[^}]*overflow-x:auto;/, 'il contenitore deve scorrere in orizzontale invece di andare a capo');
  assert.match(blocco, /#dayChoiceChips \.chip\{[^}]*flex:0 0 auto;/, 'ogni scelta non deve più occupare tutta la larghezza (flex:1 1 auto)');
});

test('regressione: selezionare un giorno dentro Registra continua a funzionare (dropset.test.js/altri dipendono da #dayChoiceChips)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    renderDayChoices();
  `);
  const chips = document.querySelectorAll('#dayChoiceChips .chip');
  assert.ok(chips.length >= 3, 'deve mostrare almeno il giorno A, Allenamento libero e Saltato');
  window.close();
});
