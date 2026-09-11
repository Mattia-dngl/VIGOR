'use strict';
// Bug di sicurezza trovato in revisione (01/09/2026): escapeAttr() sostituiva
// solo `"`, ma veniva usata in 65+ punti dell'app per inserire testo (non solo
// attributi) dentro innerHTML — nomi di esercizi, note, messaggi di chat
// PT↔cliente, nomi dei giorni della scheda... Un valore contenente
// "<img src=x onerror=...>" veniva quindi ESEGUITO invece che mostrato come
// testo. customConfirm() aveva lo stesso problema: il messaggio finiva in
// innerHTML senza alcun escape.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

const PAYLOAD = '<img src=x onerror=alert(1)>';

test('escapeAttr: neutralizza tutti i caratteri speciali HTML, non solo le virgolette', async () => {
  const { window } = await loadApp();
  const r = await run(window, `return escapeAttr(${JSON.stringify(PAYLOAD)});`);
  assert.ok(!r.includes('<img'), 'il tag non deve sopravvivere così com\'è: ' + r);
  assert.match(r, /&lt;img/);
  window.close();
});

test('pannello admin: un nome/email con markup in "Richieste in attesa" non viene eseguito', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    window.__righeAdmin = [
      { id:'admin', nome:'Mattia', email:'dangelomattia2002@gmail.com', approvato:true, is_pt:false, dati:{logs:[]} },
      { id:'p1', nome: ${JSON.stringify(PAYLOAD)}, email: ${JSON.stringify(PAYLOAD)}, approvato:false, dati:{logs:[]} }
    ];
    utenteOnline = { id:'admin', email:'dangelomattia2002@gmail.com' };
    sb = { from(){ return { select(){ return this; }, order(){ return Promise.resolve({ data: window.__righeAdmin, error:null }); } }; } };
    await renderAmministrazioneOnline();
  `);
  const box = document.getElementById('elencoAttesa');
  assert.equal(box.querySelectorAll('img').length, 0,
    'il nome/email di una richiesta in attesa non deve creare un <img> reale (eseguito nella sessione dell\'admin che approva)');
  window.close();
});

test('customConfirm: il messaggio (può contenere nome/email di un profilo) non viene eseguito come HTML', async () => {
  const { window, document } = await loadApp();
  await run(window, `customConfirm(${JSON.stringify('Eliminare "' + PAYLOAD + '"?')}, ()=>{});`);
  const box = document.querySelector('.custom-confirm-box');
  assert.ok(box, 'il popup di conferma deve comparire');
  assert.equal(box.querySelectorAll('img').length, 0, 'il testo del messaggio non deve creare un <img> reale');
  window.close();
});

test('customConfirm: gli "a-capo" (\\n) nel messaggio restano visibili come interruzioni di riga', async () => {
  const { window, document } = await loadApp();
  await run(window, `customConfirm("Riga uno\\n\\nRiga due", ()=>{});`);
  const p = document.querySelector('.custom-confirm-box p');
  assert.equal(p.querySelectorAll('br').length, 2);
  window.close();
});

// ============================================================
// 11/09/2026 — stessa falla, punti rimasti scoperti: "Note del PT" e i campi
// della dieta (colazione/pranzo/spuntino/cena e il testo del giorno libero)
// sono i testi più liberi dell'app — il PT ci scrive prosa — e finivano in
// innerHTML senza passare da escapeAttr, in quattro viste: la scheda del
// cliente, l'editor, il dettaglio delle schede archiviate e la vista del PT.
// Non è solo sicurezza (il PT scrive, il cliente legge): una nota del tutto
// innocente come "carico < 70% del massimale" veniva letta come l'inizio di
// un tag e si mangiava il resto della card.
// ============================================================
test('Note del PT: markup nella nota non viene eseguito nella scheda del cliente', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const p = state.profiles[0];
    const prog = p.programs[0];
    prog.notePT = ${JSON.stringify(PAYLOAD)};
    prog.days = [{name:'A', key:'a', exercises:[{name:'Panca', sets:[{reps:'10', kg:'50'}]}]}];
    p.activeProgramId = prog.id;
    normalizzaProfilo(p);
    renderSchedaView();
  `);
  const card = document.querySelector('.scheda-note-pt-card');
  assert.ok(card, 'la card "Note del PT" deve comparire');
  assert.equal(card.querySelectorAll('img').length, 0, 'la nota non deve creare un <img> reale');
  window.close();
});

test('Note del PT: una nota con "<" resta leggibile per intero invece di mangiarsi la card', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const p = state.profiles[0];
    const prog = p.programs[0];
    prog.notePT = 'Tieni il carico <70% del massimale, poi scarica';
    prog.days = [{name:'A', key:'a', exercises:[{name:'Panca', sets:[{reps:'10', kg:'50'}]}]}];
    p.activeProgramId = prog.id;
    normalizzaProfilo(p);
    renderSchedaView();
  `);
  const p = document.querySelector('.scheda-note-pt-card p');
  assert.equal(p.textContent, 'Tieni il carico <70% del massimale, poi scarica',
    'il testo dopo il "<" non deve sparire (senza spazio il parser lo legge come inizio di tag)');
  window.close();
});

test('Dieta: markup nei pasti non viene eseguito nella vista del cliente', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const p = state.profiles[0];
    const prog = p.programs[0];
    prog.diet = defaultDietDays();
    prog.diet['Lunedì'] = { colazione: ${JSON.stringify(PAYLOAD)}, pranzo:'', spuntino:'', cena:'' };
    prog.diet['Martedì'] = { libera:true, testo: ${JSON.stringify(PAYLOAD)} };
    p.activeProgramId = prog.id;
    normalizzaProfilo(p);
    renderDietPlanView();
  `);
  const box = document.getElementById('dietViewCard');
  assert.equal(box.querySelectorAll('img').length, 0,
    'né i pasti né il testo del giorno libero devono creare un <img> reale');
  window.close();
});

test('Dieta: un pasto con "<" resta leggibile per intero', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const p = state.profiles[0];
    const prog = p.programs[0];
    prog.diet = defaultDietDays();
    prog.diet['Lunedì'] = { colazione: 'Yogurt <100 kcal con frutta', pranzo:'', spuntino:'', cena:'' };
    p.activeProgramId = prog.id;
    normalizzaProfilo(p);
    renderDietPlanView();
  `);
  const testo = document.getElementById('dietViewCard').textContent;
  assert.match(testo, /Yogurt <100 kcal con frutta/, 'il testo dopo il "<" non deve sparire');
  window.close();
});

test('Dieta: markup nei pasti non viene eseguito nemmeno nella vista del PT', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id:'pt-1' };
    const dieta = defaultDietDays();
    dieta['Lunedì'] = { colazione: ${JSON.stringify(PAYLOAD)}, pranzo:'', spuntino:'', cena:'' };
    dieta['Martedì'] = { libera:true, testo: ${JSON.stringify(PAYLOAD)} };
    const riga = { id:'c1', nome:'Cliente', email:'c@test.it',
      dati:{ logs:[], programs:[{id:'p1', name:'S', days:[], diet:dieta, dietInfo:{}}], activeProgramId:'p1' } };
    _clienteAperto = { riga, rapporto:{ id:'r1', pt_id:'pt-1', cliente_id:'c1', stato:'attivo', puo_scheda:true, puo_dieta:true } };
    renderDettaglioPT('dieta');
  `);
  assert.equal(document.querySelectorAll('#dettaglioPT img, #areaPT img').length, 0,
    'la dieta del cliente non deve creare un <img> reale nella schermata del PT');
  window.close();
});

test('Archivio schede: markup nei pasti di una scheda archiviata non viene eseguito', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const p = state.profiles[0];
    const dieta = defaultDietDays();
    dieta['Lunedì'] = { colazione: ${JSON.stringify(PAYLOAD)}, pranzo:'', spuntino:'', cena:'' };
    p.programs = [
      {id:'vecchia', name:'Vecchia', createdAt:'2026-01-01', archivedAt:'2026-02-01',
       days:[{name:'A', key:'a', exercises:[{name:'Panca', sets:[{reps:'10', kg:'50'}]}]}], diet:dieta, dietInfo:{}},
      {id:'attiva', name:'Attiva', createdAt:'2026-02-01', archivedAt:null,
       days:[{name:'B', key:'b', exercises:[{name:'Squat', sets:[{reps:'5', kg:'90'}]}]}], diet:{}, dietInfo:{}}
    ];
    p.activeProgramId = 'attiva';
    normalizzaProfilo(p);
    renderArchiveList();
  `);
  assert.equal(document.getElementById('archiveList').querySelectorAll('img').length, 0,
    'il dettaglio di una scheda archiviata non deve creare un <img> reale');
  window.close();
});

test('Scheda: markup nel nome della scheda, del giorno, dell\'esercizio e nella nota non viene eseguito', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const p = state.profiles[0];
    const prog = p.programs[0];
    prog.name = ${JSON.stringify(PAYLOAD)};
    prog.days = [{name: ${JSON.stringify(PAYLOAD)}, key:'a', weekday:'Lunedì',
      exercises:[{name: ${JSON.stringify(PAYLOAD)}, note: ${JSON.stringify(PAYLOAD)},
                  sets:[{reps:'10', kg:'50'}]}]}];
    p.activeProgramId = prog.id;
    normalizzaProfilo(p);
    renderSchedaView();
  `);
  assert.equal(document.getElementById('programView').querySelectorAll('img').length, 0,
    'nome scheda/giorno/esercizio e nota dell\'esercizio non devono creare un <img> reale');
  window.close();
});

test('Scheda: una nota dell\'esercizio con "<" resta leggibile per intero', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const p = state.profiles[0];
    const prog = p.programs[0];
    prog.days = [{name:'A', key:'a', weekday:'Lunedì',
      exercises:[{name:'Panca', note:'tieni <2 min di recupero', sets:[{reps:'10', kg:'50'}]}]}];
    p.activeProgramId = prog.id;
    normalizzaProfilo(p);
    renderSchedaView();
  `);
  const nota = document.querySelector('.day-view-ex-note');
  assert.ok(nota, 'la nota dell\'esercizio deve comparire');
  assert.equal(nota.textContent, 'tieni <2 min di recupero', 'il testo dopo il "<" non deve sparire');
  window.close();
});
