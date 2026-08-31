'use strict';
// Fase 3 (31/08/2026, restyling ispirato a fitflow): Dieta ristrutturata.
//  1) Anello unico kcal consumate/obiettivo (calcolaFabbisogno + mealLogs di
//     oggi) al posto delle due vecchie card "Il tuo fabbisogno calorico" +
//     "Totali di oggi" (anello a 3 segmenti P/C/F, che mostrava solo la
//     composizione, non un progresso).
//  2) Card dei pasti (Colazione/Pranzo/Spuntino/Cena) con subtotale e stato
//     fatto/da fare, al posto della vecchia lista piatta "Alimenti registrati".
//  3) Contatore acqua: funzionalità nuova (prof.waterLogs, un record per
//     data, come prof.mealLogs) — non esisteva alcun modello dati prima.
//  4) Il piano alimentare assegnato dal PT (vedi settimana + modifica) è
//     dietro una tendina richiusa di default ("Piano alimentare assegnato
//     dal PT"): in Dieta resta a vista solo il pasto di oggi (card "Oggi
//     dovresti mangiare", invariata). Nessuna funzione tolta.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloConDati(extra){
  return Object.assign({
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[{date:'2026-08-01', weight:80}],
    customExercises:{}, customFoods:{}, mealLogs:[], waterLogs:[],
    sesso:'uomo', dataNascita:'1995-06-15', altezza:180, livelloAttivita:'moderato', obiettivoCalorico:'mantenimento',
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId:'p1'
  }, extra||{});
}

test('CSS: il vecchio anello a 3 segmenti (P/C/F) non esiste più, sostituito dall\'anello kcal/obiettivo', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.ok(!/\.macro-ring-wrap/.test(css), 'il vecchio anello a 3 segmenti va rimosso, non solo affiancato');
  assert.ok(!/\.macro-seg-p/.test(css));
  assert.ok(/\.kcal-ring-fill\{[^}]*var\(--diet\)/.test(css), 'il nuovo anello deve usare il tono diet, coerente col resto della sezione');
});

test('CSS: la tendina "Piano alimentare assegnato dal PT" non è annidata dentro un\'altra card (niente doppio bordo)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.ok(/\.diet-plan-toggle > summary\{/.test(css));
});

test('renderKcalRing: senza dati per il fabbisogno mostra solo i kcal consumati, senza percentuale', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati({ sesso:null, dataNascita:null, altezza:null,
      mealLogs:[{ date: new Date().toISOString().slice(0,10), items:[{food:'riso bianco', grams:100, meal:'pranzo'}] }] }))};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
  `);
  const pct = document.getElementById('kcalRingPct').textContent;
  const value = document.getElementById('kcalRingValue').textContent;
  assert.equal(pct, '–', 'senza fabbisogno calcolabile non deve inventare una percentuale');
  assert.match(value, /^353 kcal$/);
  window.close();
});

test('renderKcalRing: con tutti i dati mostra la percentuale sull\'obiettivo e i kcal rimanenti', async () => {
  const { window, document } = await loadApp();
  const oggi = new Date().toISOString().slice(0,10);
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    profilo.mealLogs = [{ date: '${oggi}', items:[{food:'riso bianco', grams:100, meal:'pranzo'}] }];
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
  `);
  assert.match(document.getElementById('kcalRingPct').textContent, /^\d+%$/);
  assert.match(document.getElementById('kcalRingValue').textContent, /^353 \/ \d+ kcal$/);
  assert.match(document.getElementById('kcalRingSub').textContent, /kcal rimanenti/);
  window.close();
});

test('Card dei pasti: un pasto senza alimenti è "da fare" (nessun tasto: si sceglie nel diario sopra), uno con alimenti mostra il subtotale', async () => {
  const { window, document } = await loadApp();
  const oggi = new Date().toISOString().slice(0,10);
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    profilo.mealLogs = [{ date: '${oggi}', items:[{food:'riso bianco', grams:100, meal:'pranzo'}] }];
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
  `);
  const cards = document.querySelectorAll('#mealCardsWrap .meal-card');
  assert.equal(cards.length, 4, 'sempre 4 card, una per pasto, anche quelle vuote');
  const pranzo = document.querySelector('#mealCardsWrap .meal-card:nth-child(2)');
  const colazione = document.querySelector('#mealCardsWrap .meal-card:nth-child(1)');
  assert.ok(!pranzo.classList.contains('meal-card-pending'), 'pranzo ha un alimento registrato: non è più "da fare"');
  assert.match(pranzo.querySelector('.meal-card-kcal').textContent, /353 kcal/);
  assert.ok(colazione.classList.contains('meal-card-pending'), 'colazione è vuota: resta "da fare"');
  assert.equal(colazione.querySelector('.meal-card-log-btn'), null, '31/08/2026: il tasto "Registra" è stato tolto dalle card, ridondante col diario qui sopra');
  assert.equal(colazione.querySelector('.meal-card-add-btn'), null);
  window.close();
});

// 31/08/2026 (stesso giorno, seconda modifica): tolti i tasti "Registra"/"+"
// dalle card — richiesta esplicita, il pasto si sceglie già nel diario, ora
// spostato SOPRA le card (prima era sotto). Le card sono un riepilogo di
// sola lettura, ogni alimento con la scomposizione nutrienti completa.
test('Diario alimentare: viene prima delle card dei pasti nel markup (prima era il contrario)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
  `);
  const diario = Array.from(document.querySelectorAll('#view-diet h3')).find(h => h.textContent === 'Diario alimentare');
  const cardsWrap = document.getElementById('mealCardsWrap');
  assert.ok(diario && cardsWrap);
  const pos = diario.compareDocumentPosition(cardsWrap);
  assert.ok(pos & window.Node.DOCUMENT_POSITION_FOLLOWING, 'il diario deve venire prima delle card dei pasti');
  window.close();
});

test('Card dei pasti: ogni alimento mostra la scomposizione nutrienti completa (prima solo le kcal del subtotale)', async () => {
  const { window, document } = await loadApp();
  const oggi = new Date().toISOString().slice(0,10);
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    profilo.mealLogs = [{ date: '${oggi}', items:[{food:'riso bianco', grams:100, meal:'pranzo'}] }];
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
  `);
  const pranzo = document.querySelector('#mealCardsWrap .meal-card:nth-child(2)');
  const nutr = pranzo.querySelector('.meal-card-food-nutr').textContent;
  assert.match(nutr, /kcal/);
  assert.match(nutr, /P [\d.,]+g/i);
  assert.match(nutr, /C [\d.,]+g/i);
  assert.match(nutr, /G [\d.,]+g/i);
  window.close();
});

test('Rimuovere un alimento da una card di un pasto lo toglie dal diario (stesso comportamento della vecchia lista)', async () => {
  const { window, document } = await loadApp();
  const oggi = new Date().toISOString().slice(0,10);
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    profilo.mealLogs = [{ date: '${oggi}', items:[{food:'riso bianco', grams:100, meal:'pranzo'}] }];
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
  `);
  const removeBtn = document.querySelector('#mealCardsWrap .remove-x');
  assert.ok(removeBtn, 'deve esserci un tasto di rimozione sulla riga alimento');
  removeBtn.click();
  const pranzo = document.querySelector('#mealCardsWrap .meal-card:nth-child(2)');
  assert.ok(pranzo.classList.contains('meal-card-pending'), 'dopo la rimozione il pasto torna "da fare"');
  window.close();
});

test('Acqua: aggiungere e togliere 250ml aggiorna il valore, senza scendere sotto zero', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
    document.getElementById('waterPlusBtn').click();
    document.getElementById('waterPlusBtn').click();
  `);
  assert.equal(document.getElementById('waterValue').textContent, '0,50 / 2,50 L');
  await run(window, `
    document.getElementById('waterMinusBtn').click();
    document.getElementById('waterMinusBtn').click();
    document.getElementById('waterMinusBtn').click();
  `);
  assert.equal(document.getElementById('waterValue').textContent, '0,00 / 2,50 L', 'non deve andare sotto zero');
  window.close();
});

test('Acqua: il valore si salva su prof.waterLogs per data, come mealLogs', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
    document.getElementById('waterPlusBtn').click();
    const prof = activeProfile();
    return { waterLogs: prof.waterLogs };
  `);
  assert.equal(r.waterLogs.length, 1);
  assert.equal(r.waterLogs[0].ml, 250);
  window.close();
});

test('Piano alimentare assegnato dal PT: la tendina è richiusa di default', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
  `);
  const det = document.getElementById('pianoPTDetails');
  assert.ok(det, 'la tendina deve esistere');
  assert.equal(det.open, false, 'deve restare chiusa finché l\'utente non la apre');
  // il contenuto (vedi/modifica piano) deve comunque esserci nel DOM, solo nascosto dalla <details>
  assert.ok(document.getElementById('dietView'), 'renderDietPlanView() deve continuare a funzionare (nessuna funzione tolta)');
  window.close();
});

test('Piano alimentare assegnato dal PT: passare a "Modifica" apre la tendina in automatico', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
  `);
  document.querySelector('.seg-btn[data-segd="edit"]').click();
  assert.equal(document.getElementById('pianoPTDetails').open, true);
  assert.equal(document.getElementById('dietPlanEditBlock').style.display, 'block');
  window.close();
});

test('"Oggi dovresti mangiare" (piano del PT per oggi) resta sempre a vista, fuori dalla tendina', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati({ programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}],
      dietInfo:{}, diet:{ Lunedì:{ libera:false, colazione:'Uova e avena', pranzo:'Pollo e riso', spuntino:'', cena:'' } } }] }))};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
  `);
  const box = document.getElementById('todayDietPlan');
  assert.match(box.innerHTML, /Uova e avena/);
  const det = document.getElementById('pianoPTDetails');
  assert.ok(!det.contains(box), '"Oggi dovresti mangiare" non deve stare dentro la tendina richiudibile');
  window.close();
});
