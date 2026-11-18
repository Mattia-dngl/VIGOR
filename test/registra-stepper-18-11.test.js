'use strict';
// 18/11/2026 — Registra: serie con stepper (− / +) e valori suggeriti, senza
// tastiera. Gli <input> restano quelli di sempre (readonly): qui si verifica
// che i valori suggeriti vengano dall'ultima volta / serie prima / target, che
// un tocco sul ✓ li confermi, che −/+ partano dal suggerito e che il salvataggio
// continui a leggere da currentSetInputs come prima.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

const PROFILO = (logs) => `
  const profilo = {
    id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
    logs: ${JSON.stringify(logs)},
    programs: [{ id:'p1', days:[{
      key:'A', name:'Schiena', weekday:'Lunedì',
      exercises:[
        { name:'Rematore', sets:4, reps:'8-10', muscles:['Schiena'] },
        { name:'Lat Machine', sets:2, reps:'12', muscles:['Schiena'] }
      ]
    }] }], activeProgramId:'p1'
  };
  state.profiles = [profilo]; activeProfileId = 'io';
  logDateInput.value = '2026-02-10';
  selectDay('A');
`;
const LOG_PRECEDENTE = [{
  id:'l1', date:'2026-02-03', programId:'p1', status:'registrato', dayKey:'A', dayName:'Schiena',
  exercises:[{ name:'Rematore', sets:[
    {reps:'10', kg:'40'}, {reps:'10', kg:'40'}, {reps:'9', kg:'42.5'}, {reps:'8', kg:'42.5'}
  ]}]
}];

const inp = (document, ex, idx, f) =>
  document.querySelector(`.exercise-block input[data-ex="${ex}"][data-idx="${idx}"][data-field="${f}"]`);
const riga = (document, ex, idx) => inp(document, ex, idx, 'reps').closest('.set-row');

test('Registra: i campi serie non aprono la tastiera (readonly) ma restano gli stessi input', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO([]));
  const kg = inp(document, 'Rematore', 0, 'kg');
  assert.ok(kg, 'il campo kg esiste ancora, con gli stessi data-attributes');
  assert.equal(kg.readOnly, true, 'readonly: toccarlo non deve far comparire la tastiera');
  assert.equal(kg.step, '0.5');
  assert.equal(kg.inputMode, 'decimal', 'se si scrive a mano (pressione lunga) serve la tastiera con la virgola');
  assert.equal(riga(document, 'Rematore', 0).querySelectorAll('.step-btn').length, 4, '− e + per rip. e per kg');
  window.close();
});

test('Registra: con una volta precedente, il suggerito di ogni serie è quello della stessa serie dell\'ultima volta', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO(LOG_PRECEDENTE));
  assert.equal(inp(document, 'Rematore', 0, 'reps').placeholder, '10');
  assert.equal(inp(document, 'Rematore', 0, 'kg').placeholder, '40');
  assert.equal(inp(document, 'Rematore', 2, 'reps').placeholder, '9');
  assert.equal(inp(document, 'Rematore', 3, 'kg').placeholder, '42.5');
  assert.equal(inp(document, 'Rematore', 0, 'kg').dataset.ghost, '40');
  // il suggerito NON è un valore: nulla è registrato finché non lo confermi
  assert.equal(inp(document, 'Rematore', 0, 'kg').value, '');
  const dati = await run(window, `return currentSetInputs['Rematore'][0]`);
  assert.equal(dati.kg, '');
  window.close();
});

test('Registra: un tocco sul ✓ conferma i valori suggeriti e segna la serie fatta', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO(LOG_PRECEDENTE));
  riga(document, 'Rematore', 0).querySelector('.set-fatta-btn').click();
  assert.equal(inp(document, 'Rematore', 0, 'reps').value, '10');
  assert.equal(inp(document, 'Rematore', 0, 'kg').value, '40');
  const s = await run(window, `return currentSetInputs['Rematore'][0]`);
  assert.equal(s.reps, '10');
  assert.equal(s.kg, '40');
  assert.equal(s._fatta, true);
  assert.ok(riga(document, 'Rematore', 0).classList.contains('fatta'));
  window.close();
});

test('Registra: "+" e "−" partono dal valore suggerito e il ✓ non sovrascrive ciò che hai già toccato', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO(LOG_PRECEDENTE));
  const r = riga(document, 'Rematore', 2);              // suggerito: 9 × 42,5
  r.querySelectorAll('.step-btn[data-dir="1"]')[1].click();   // kg: 42,5 + 2,5
  r.querySelectorAll('.step-btn[data-dir="-1"]')[0].click();  // rip.: 9 − 1
  assert.equal(inp(document, 'Rematore', 2, 'kg').value, '45');
  assert.equal(inp(document, 'Rematore', 2, 'reps').value, '8');
  r.querySelector('.set-fatta-btn').click();
  assert.equal(inp(document, 'Rematore', 2, 'kg').value, '45', 'il ✓ non riporta il campo al suggerito');
  const s = await run(window, `return currentSetInputs['Rematore'][2]`);
  assert.equal(s.kg, '45');
  assert.equal(s.reps, '8');
  window.close();
});

test('Registra: "−" fino a zero svuota il campo (un "0" conterebbe come serie compilata)', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO([]));
  const r = riga(document, 'Rematore', 0);
  const plusReps = r.querySelectorAll('.step-btn[data-dir="1"]')[0];
  const minusReps = r.querySelectorAll('.step-btn[data-dir="-1"]')[0];
  // niente storico: il suggerito delle rip. è il target (8-10 → 8)
  assert.equal(inp(document, 'Rematore', 0, 'reps').dataset.ghost, '8');
  minusReps.click(); minusReps.click();                  // 8 → 7 → 6
  for(let i=0;i<10;i++) minusReps.click();
  assert.equal(inp(document, 'Rematore', 0, 'reps').value, '', 'sotto 1 il campo torna vuoto');
  const s = await run(window, `return currentSetInputs['Rematore'][0].reps`);
  assert.equal(s, '');
  plusReps.click();
  assert.equal(inp(document, 'Rematore', 0, 'reps').value, '1');
  window.close();
});

test('Registra: senza storico la serie dopo suggerisce i valori della serie appena compilata', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO([]));
  const r0 = riga(document, 'Lat Machine', 0);
  assert.equal(inp(document, 'Lat Machine', 0, 'kg').dataset.ghost, undefined, 'nessun peso da suggerire la prima volta');
  assert.equal(inp(document, 'Lat Machine', 0, 'reps').dataset.ghost, '12', 'rip.: il target della scheda');
  r0.querySelectorAll('.step-btn[data-dir="1"]')[1].click();   // kg 0 → 2,5
  r0.querySelectorAll('.step-btn[data-dir="1"]')[1].click();   // → 5
  r0.querySelector('.set-fatta-btn').click();
  assert.equal(inp(document, 'Lat Machine', 0, 'kg').value, '5');
  assert.equal(inp(document, 'Lat Machine', 1, 'kg').dataset.ghost, '5', 'la serie 2 propone il peso della serie 1');
  assert.equal(inp(document, 'Lat Machine', 1, 'reps').dataset.ghost, '12');
  window.close();
});

test('Registra: un solo anello "prossima serie" in tutto l\'allenamento, anche con più esercizi', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO([]));
  assert.equal(document.querySelectorAll('.exercise-block .set-row.next').length, 1);
  window.close();
});

test('Registra: per un esercizio a tempo il suggerito è il target in secondi (non solo le rip.)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{}, logs:[],
      programs: [{ id:'p1', days:[{ key:'A', name:'Core', weekday:'Lunedì',
        exercises:[{ name:'Plank', sets:2, reps:'40', muscles:['Core/Addome'] }] }] }], activeProgramId:'p1'
    };
    state.profiles = [profilo]; activeProfileId = 'io';
    logDateInput.value = '2026-02-10';
    selectDay('A');
  `);
  assert.equal(inp(document, 'Plank', 0, 'seconds').dataset.ghost, '40');
  window.close();
});

test('Registra: la prossima serie da fare è evidenziata e si sposta quando segni quella corrente', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO(LOG_PRECEDENTE));
  assert.ok(riga(document, 'Rematore', 0).classList.contains('next'));
  assert.ok(!riga(document, 'Rematore', 1).classList.contains('next'));
  riga(document, 'Rematore', 0).querySelector('.set-fatta-btn').click();
  assert.ok(!riga(document, 'Rematore', 0).classList.contains('next'));
  assert.ok(riga(document, 'Rematore', 1).classList.contains('next'));
  window.close();
});

test('Registra: il salvataggio registra i valori confermati con il ✓ (come se fossero stati digitati)', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO(LOG_PRECEDENTE));
  for(let i=0;i<4;i++) riga(document, 'Rematore', i).querySelector('.set-fatta-btn').click();
  await run(window, `document.getElementById('saveLogBtn').click();`);
  const log = await run(window, `return activeProfile().logs.find(l => l.id !== 'l1')`);
  assert.ok(log, 'il nuovo allenamento è stato salvato');
  const ex = log.exercises.find(e => e.name === 'Rematore');
  assert.deepEqual(ex.sets.map(s => [s.reps, s.kg]), [['10','40'],['10','40'],['9','42.5'],['8','42.5']]);
  window.close();
});

test('Registra: le tappe di un dropset non hanno suggeriti e restano ricalcolate da sole', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{}, logs:[],
      programs: [{ id:'p1', days:[{ key:'A', name:'Petto', weekday:'Lunedì',
        exercises:[{ name:'Panca Piana', sets:1, reps:'10', muscles:['Petto'],
                     dropset:{ tipo:'dropset', drops:[{riduzione:25}] } }] }] }], activeProgramId:'p1'
    };
    state.profiles = [profilo]; activeProfileId = 'io';
    logDateInput.value = '2026-02-10';
    selectDay('A');
  `);
  const righe = document.querySelectorAll('.exercise-block .set-row');
  assert.equal(righe.length, 2, 'serie principale + 1 drop');
  const drop = righe[1];
  assert.equal(drop.querySelector('[data-field="kg"]').dataset.ghost, undefined);
  assert.equal(drop.querySelector('[data-field="reps"]').dataset.ghost, undefined);
  // la principale: kg 100 → il drop si ricalcola a 75 (−25%) come prima
  const kgMain = righe[0].querySelector('[data-field="kg"]');
  kgMain.value = '100';
  kgMain.dispatchEvent(new window.Event('input', { bubbles:true }));
  assert.equal(drop.querySelector('[data-field="kg"]').value, '75');
  window.close();
});

test('Registra: la bozza ripristinata mostra i valori e aggiorna i suggeriti delle serie ancora vuote', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO([]));
  const r0 = riga(document, 'Lat Machine', 0);
  r0.querySelectorAll('.step-btn[data-dir="1"]')[1].click();
  r0.querySelector('.set-fatta-btn').click();            // 12 × 2,5
  await run(window, `_bozzaPronta = true; salvaBozza();`);
  await run(window, `ripristinaBozza();`);
  assert.equal(inp(document, 'Lat Machine', 0, 'kg').value, '2.5');
  assert.equal(inp(document, 'Lat Machine', 1, 'kg').dataset.ghost, '2.5');
  window.close();
});
