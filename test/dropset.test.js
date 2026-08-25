'use strict';
// Test della tecnica "dropset"/"rest-pause", sia nella schermata Registra
// (index.html: buildDropsetRound, calcolaRipartizioneRipetizioni) sia
// nell'editor della scheda (renderExerciseEditors, pulsante "×" di ogni tappa).
// Copre tre correzioni:
//  1) il peso dei drop si arrotonda ai 5 kg (non più ai 0,25 kg)
//  2) le ripetizioni dei drop si calcolano da quelle scritte nella serie
//     principale rispetto al target dell'esercizio, non più fisse a "8"
//  3) togliere una singola tappa (drop/rest-pause) nell'editor scheda non
//     deve più cancellare l'intero esercizio (bug della classe CSS condivisa
//     "remove-x" tra il tasto della tappa e quello dell'esercizio)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('calcolaRipartizioneRipetizioni: riproduce gli esempi (target 20, principale 10)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return {
      due: calcolaRipartizioneRipetizioni(20, 10, 2),
      tre: calcolaRipartizioneRipetizioni(20, 10, 3)
    };
  `);
  assert.deepEqual(r.due, [6, 4]);
  assert.deepEqual(r.tre, [5, 3, 2]);
  window.close();
});

test('calcolaRipartizioneRipetizioni: se la principale raggiunge già il target, alle tappe non resta nulla (0, non un minimo forzato)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return {
      principaleUgualeTarget: calcolaRipartizioneRipetizioni(20, 20, 2),   // target 20, principale già 20
      principaleUgualeTargetTreTappe: calcolaRipartizioneRipetizioni(20, 20, 3)
    };
  `);
  // la serie deve sempre ridare il target totale, mai di più: se la principale
  // lo raggiunge già da sola, i drop restano a 0 (non a un minimo di 1 a testa)
  assert.deepEqual(r.principaleUgualeTarget, [0, 0]);
  assert.deepEqual(r.principaleUgualeTargetTreTappe, [0, 0, 0]);
  window.close();
});

test('calcolaRipartizioneRipetizioni: non va mai a zero e somma sempre in modo sensato', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return {
      targetIrraggiungibile: calcolaRipartizioneRipetizioni(NaN, 8, 3),   // niente target leggibile: si ripartisce da "principale"
      principaleOltreTarget: calcolaRipartizioneRipetizioni(10, 15, 2),   // principale già oltre il target
      unaSolaTappa: calcolaRipartizioneRipetizioni(20, 18, 1)
    };
  `);
  assert.ok(r.targetIrraggiungibile.every(v=>v>=1));
  assert.equal(r.targetIrraggiungibile.reduce((a,b)=>a+b,0), 8); // ripartisce gli 8 della principale
  assert.ok(r.principaleOltreTarget.every(v=>v>=1));
  // un solo drop prende semplicemente quello che manca per arrivare al target (20-18=2)
  assert.deepEqual(r.unaSolaTappa, [2]);
  window.close();
});

// sets:1 perché buildExerciseForm crea un round per ogni serie (ex.sets): con più
// di un round i selettori sotto prenderebbero anche i drop dei round successivi.
function giornoConDropset(riduzioni){
  return {
    key:'A', name:'Petto', weekday:'Lunedì',
    exercises: [{
      name:'Chest Press', sets:1, reps:'20', muscles:['Petto'],
      dropset: { tipo:'dropset', drops: riduzioni.map(riduzione=>({reps:'8', riduzione})) }
    }]
  };
}

test('buildDropsetRound: il peso dei drop si arrotonda ai 5 kg', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConDropset([25, 25]))});

    const principale = document.querySelector('.exercise-block .drop-row-main [data-field="kg"]');
    principale.value = '55';
    principale.dispatchEvent(new window.Event('input', {bubbles:true}));

    const kgDrop = Array.from(document.querySelectorAll('.exercise-block .drop-row:not(.drop-row-main) [data-field="kg"]')).map(i=>i.value);
    return kgDrop;
  `);
  // 55 -25% = 41.25 → arrotondato ai 5 kg più vicini = 40; 40 -25% = 30 (già multiplo di 5)
  assert.deepEqual(r, ['40', '30']);
  window.close();
});

test('buildDropsetRound: le ripetizioni dei drop seguono quelle scritte nella serie principale', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConDropset([25, 25]))});   // target esercizio: 20 rip. (ex.reps)

    const principale = document.querySelector('.exercise-block .drop-row-main [data-field="reps"]');
    const repsPrimaDiScrivere = Array.from(document.querySelectorAll('.exercise-block .drop-row:not(.drop-row-main) [data-field="reps"]')).map(i=>i.value);

    principale.value = '10';
    principale.dispatchEvent(new window.Event('input', {bubbles:true}));
    const repsDopo = Array.from(document.querySelectorAll('.exercise-block .drop-row:not(.drop-row-main) [data-field="reps"]')).map(i=>i.value);

    return { repsPrimaDiScrivere, repsDopo };
  `);
  // prima di scrivere nella serie principale, i drop non hanno più un fisso "8": restano vuoti
  assert.deepEqual(r.repsPrimaDiScrivere, ['', '']);
  // target 20, principale 10 → 6 e 4 (stesso esempio del calcolo puro)
  assert.deepEqual(r.repsDopo, ['6', '4']);
  window.close();
});

test('buildDropsetRound: cancellando le ripetizioni della principale si svuotano anche quelle calcolate dei drop', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConDropset([25, 25]))});   // target esercizio: 20 rip.

    const principale = document.querySelector('.exercise-block .drop-row-main [data-field="reps"]');
    principale.value = '10';
    principale.dispatchEvent(new window.Event('input', {bubbles:true}));
    const repsCalcolati = Array.from(document.querySelectorAll('.exercise-block .drop-row:not(.drop-row-main) [data-field="reps"]')).map(i=>i.value);

    // ora cancello quanto scritto nella principale
    principale.value = '';
    principale.dispatchEvent(new window.Event('input', {bubbles:true}));
    const repsDopoCancellazione = Array.from(document.querySelectorAll('.exercise-block .drop-row:not(.drop-row-main) [data-field="reps"]')).map(i=>i.value);

    return { repsCalcolati, repsDopoCancellazione };
  `);
  assert.deepEqual(r.repsCalcolati, ['6', '4']);
  // niente valori "vecchi" lasciati sui drop: devono svuotarsi insieme alla principale
  assert.deepEqual(r.repsDopoCancellazione, ['', '']);
  window.close();
});

test('buildDropsetRound: se la principale raggiunge il target dell\'esercizio, i drop mostrano 0', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConDropset([25, 25]))});   // target esercizio: 20 rip.

    const principale = document.querySelector('.exercise-block .drop-row-main [data-field="reps"]');
    principale.value = '20';   // uguale al target
    principale.dispatchEvent(new window.Event('input', {bubbles:true}));
    return Array.from(document.querySelectorAll('.exercise-block .drop-row:not(.drop-row-main) [data-field="reps"]')).map(i=>i.value);
  `);
  assert.deepEqual(r, ['0', '0']);
  window.close();
});

test('descriviSerie: con un dropset, raggruppa "Ultima volta" per round invece di una lista piatta', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const serie = [
      {reps:'10', kg:'45'}, {reps:'6', kg:'30'}, {reps:'4', kg:'20'},
      {reps:'10', kg:'45'}, {reps:'6', kg:'30'}, {reps:'4', kg:'20'}
    ];
    const dropset = { tipo:'dropset', drops:[{riduzione:25},{riduzione:25}] };
    return {
      conDropset: descriviSerie(serie, 'Chest Press', dropset),
      senzaDropset: descriviSerie(serie, 'Chest Press')   // comportamento invariato per gli altri usi (storico, calendario)
    };
  `);
  assert.equal(r.conDropset, 'Serie 1: 10×45 → drop 1 6×30 → drop 2 4×20 | Serie 2: 10×45 → drop 1 6×30 → drop 2 4×20');
  assert.equal(r.senzaDropset, '10×45, 6×30, 4×20, 10×45, 6×30, 4×20');
  window.close();
});

test('editor scheda: togliere una tappa del dropset non cancella l\'esercizio', async () => {
  const { window } = await loadApp();
  const giorno = giornoConDropset([25, 25, 25]);   // 3 tappe
  const r = await run(window, `
    editingDays = [${JSON.stringify(giorno)}];
    renderDayEditors();   // costruisce anche il contenitore .ex-list che renderExerciseEditors si aspetta
    const esercizePrima = editingDays[0].exercises.length;
    const tappePrima = editingDays[0].exercises[0].dropset.drops.length;

    // click sul "×" della PRIMA tappa (drop), non sul "×" dell'esercizio
    document.querySelector('.dropset-remove[data-dj="0"]').click();

    return {
      esercizePrima, tappePrima,
      esercizeDopo: editingDays[0].exercises.length,
      tappeDopo: editingDays[0] && editingDays[0].exercises[0] ? editingDays[0].exercises[0].dropset.drops.length : null
    };
  `);
  assert.equal(r.esercizePrima, 1);
  assert.equal(r.tappePrima, 3);
  assert.equal(r.esercizeDopo, 1, 'l\'esercizio non deve sparire togliendo una sola tappa');
  assert.equal(r.tappeDopo, 2, 'deve restare una tappa in meno, non zero');
  window.close();
});

test('editor scheda: togliere una tappa di un rest-pause non cancella l\'esercizio (stesso bug, altra tecnica)', async () => {
  const { window } = await loadApp();
  const giorno = {
    key:'A', name:'Petto', weekday:'Lunedì',
    exercises: [{ name:'Chest Press', sets:4, reps:'20', muscles:['Petto'],
      dropset: { tipo:'restpause', drops: [{reps:'6', riduzione:0}, {reps:'6', riduzione:0}] } }]
  };
  const r = await run(window, `
    editingDays = [${JSON.stringify(giorno)}];
    renderDayEditors();   // costruisce anche il contenitore .ex-list che renderExerciseEditors si aspetta
    document.querySelector('.dropset-remove[data-dj="0"]').click();
    return {
      esercizi: editingDays[0].exercises.length,
      tappe: editingDays[0].exercises[0] ? editingDays[0].exercises[0].dropset.drops.length : null
    };
  `);
  assert.equal(r.esercizi, 1);
  assert.equal(r.tappe, 1);
  window.close();
});
