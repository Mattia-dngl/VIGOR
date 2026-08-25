'use strict';
// Nuovo Storico (25/08/2026, da mockup): calendario a puntini (un puntino sui
// giorni con un allenamento DAVVERO registrato, niente più colori per "giorno
// di riposo"/"saltato"), dettaglio del giorno scelto come card a sé con
// categoria/tag "Da scheda PT"/statistiche, e un riepilogo del mese con 4
// numeri — tutti calcolati per davvero dai log, mai stimati.
//
// Gap veri rispetto al mockup, chiariti con l'utente prima di implementare:
//  - "tempo speso": non esisteva nessun cronometro nell'app. Ora selectDay()
//    fa partire un cronometro (persistito nella bozza) e saveLogBtn calcola
//    log.durataMinuti alla fine. I log salvati PRIMA di questa modifica non
//    hanno mai un tempo: la card e il riepilogo lo OMETTONO per loro, non lo
//    inventano.
//  - "categoria" (es. "FORZA"): nuovo campo facoltativo sul giorno di scheda
//    (editor scheda → CATEGORIE_ALLENAMENTO), non retroattivo.
//  - "Da scheda PT": mostrata quando c'è un rapporto PT attivo al momento
//    della visualizzazione (mioRapportoAttivo()), non tracciata per singolo
//    allenamento.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloConLog(logs, programs){
  return {
    id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
    logs, programs: programs || [], activeProgramId: programs && programs[0] ? programs[0].id : null
  };
}

test('Storico si apre di default sulla scheda "Allenamenti" (il nuovo calendario), non più su "Volume"', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConLog([]))};
    state.profiles = [profilo]; activeProfileId = 'io';
    apriStorico();
  `);
  assert.notEqual(document.getElementById('historyLogsBlock').style.display, 'none');
  assert.equal(document.getElementById('historyVolumeBlock').style.display, 'none');
  assert.ok(document.querySelector('.seg-btn[data-seg2="allenamenti"]').classList.contains('active'));
  window.close();
});

test('calendario: un puntino compare solo sui giorni con un allenamento REGISTRATO, non su quelli saltati o vuoti', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConLog([
      { id:'l1', date:'2026-08-04', status:'registrato', dayKey:'A', dayName:'Petto', exercises:[{name:'Panca Piana', sets:[{reps:'5',kg:'80'}]}], notes:'' },
      { id:'l2', date:'2026-08-05', status:'saltato', dayKey:null, dayName:null, exercises:[], notes:'' }
    ]))};
    state.profiles = [profilo]; activeProfileId = 'io';
    _calMese = new Date(2026, 7, 1);
    renderCalendarioStorico();
  `);
  const g4 = document.querySelector('#calGiorni .cal-day-nuovo[data-iso="2026-08-04"]');
  const g5 = document.querySelector('#calGiorni .cal-day-nuovo[data-iso="2026-08-05"]');
  const g6 = document.querySelector('#calGiorni .cal-day-nuovo[data-iso="2026-08-06"]');
  assert.ok(g4.querySelector('.puntino'), 'il 4 agosto (registrato) deve avere il puntino');
  assert.ok(!g5.querySelector('.puntino'), 'il 5 agosto (saltato) NON deve avere il puntino');
  assert.ok(!g6.querySelector('.puntino'), 'il 6 agosto (nessun log) NON deve avere il puntino');
  window.close();
});

test('cliccando un giorno del calendario si apre la sua card di dettaglio, con esercizi e kg totali calcolati dai log', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConLog([
      { id:'l1', date:'2026-08-04', status:'registrato', dayKey:'A', dayName:'Petto e Tricipiti',
        exercises:[
          { name:'Panca Piana', sets:[{reps:'10',kg:'80'},{reps:'8',kg:'80'}] },
          { name:'French Press', sets:[{reps:'12',kg:'20'}] }
        ], notes:'' }
    ]))};
    state.profiles = [profilo]; activeProfileId = 'io';
    _calMese = new Date(2026, 7, 1);
    renderCalendarioStorico();
    document.querySelector('#calGiorni .cal-day-nuovo[data-iso="2026-08-04"]').click();
  `);
  const dettaglio = document.getElementById('calDettaglio');
  assert.match(dettaglio.querySelector('.storico-giorno-titolo').textContent, /Martedì 4 Agosto/);
  assert.match(dettaglio.querySelector('.workout-title').textContent, /Petto e Tricipiti/);
  const testoStats = dettaglio.querySelector('.workout-stats-row').textContent;
  assert.match(testoStats, /2 esercizi/);
  // kg totali = 10*80 + 8*80 + 12*20 = 800+640+240 = 1680
  assert.match(testoStats, /1\.680 kg totali|1680 kg totali/);
  assert.equal(dettaglio.querySelector('.workout-tags'), null, 'senza categoria e senza PT collegato non deve comparire nessuna etichetta');
  window.close();
});

test('un giorno senza allenamento mostra un messaggio chiaro, uno saltato lo dice esplicitamente', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConLog([
      { id:'l2', date:'2026-08-05', status:'saltato', dayKey:null, dayName:null, exercises:[], notes:'' }
    ]))};
    state.profiles = [profilo]; activeProfileId = 'io';
    _calMese = new Date(2026, 7, 1);
    renderCalendarioStorico();
    document.querySelector('#calGiorni .cal-day-nuovo[data-iso="2026-08-05"]').click();
  `);
  assert.match(document.getElementById('calDettaglio').textContent, /Segnato come saltato/);

  await run(window, `document.querySelector('#calGiorni .cal-day-nuovo[data-iso="2026-08-06"]').click();`);
  assert.match(document.getElementById('calDettaglio').textContent, /Nessun allenamento registrato/);
  window.close();
});

test('un log SENZA durata tracciata (salvato prima di questa modifica) non mostra un tempo inventato', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConLog([
      { id:'l1', date:'2026-08-04', status:'registrato', dayKey:'A', dayName:'Petto',
        exercises:[{ name:'Panca Piana', sets:[{reps:'10',kg:'80'}] }], notes:'' }
    ]))};
    state.profiles = [profilo]; activeProfileId = 'io';
    _calMese = new Date(2026, 7, 1);
    renderCalendarioStorico();
    document.querySelector('#calGiorni .cal-day-nuovo[data-iso="2026-08-04"]').click();
  `);
  const testoStats = document.querySelector('#calDettaglio .workout-stats-row').textContent;
  assert.ok(!/min/.test(testoStats), 'senza durataMinuti non deve comparire nessun "... min"');
  window.close();
});

test('un log CON durata tracciata la mostra nella card', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConLog([
      { id:'l1', date:'2026-08-04', status:'registrato', dayKey:'A', dayName:'Petto', durataMinuti: 58,
        exercises:[{ name:'Panca Piana', sets:[{reps:'10',kg:'80'}] }], notes:'' }
    ]))};
    state.profiles = [profilo]; activeProfileId = 'io';
    _calMese = new Date(2026, 7, 1);
    renderCalendarioStorico();
    document.querySelector('#calGiorni .cal-day-nuovo[data-iso="2026-08-04"]').click();
  `);
  assert.match(document.querySelector('#calDettaglio .workout-stats-row').textContent, /58 min/);
  window.close();
});

test('categoria del giorno di scheda: compare come etichetta sulla card se il giorno ce l\'ha impostata', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConLog(
      [{ id:'l1', date:'2026-08-04', programId:'p1', status:'registrato', dayKey:'A', dayName:'Petto',
         exercises:[{ name:'Panca Piana', sets:[{reps:'10',kg:'80'}] }], notes:'' }],
      [{ id:'p1', name:'Scheda', days:[{ key:'A', name:'Petto', weekday:'Martedì', categoria:'forza', exercises:[] }] }]
    ))};
    state.profiles = [profilo]; activeProfileId = 'io';
    _calMese = new Date(2026, 7, 1);
    renderCalendarioStorico();
    document.querySelector('#calGiorni .cal-day-nuovo[data-iso="2026-08-04"]').click();
  `);
  const tag = document.querySelector('#calDettaglio .workout-tag');
  assert.ok(tag, 'deve comparire l\'etichetta di categoria');
  assert.match(tag.textContent, /FORZA/);
  window.close();
});

test('riepilogo mensile: allenamenti totali, volume totale (kg) e miglior streak sono calcolati davvero dai log', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConLog([
      // streak di 3 giorni consecutivi (4,5,6), poi un giorno isolato (8)
      { id:'l1', date:'2026-08-04', status:'registrato', dayKey:'A', dayName:'A', exercises:[{name:'Panca', sets:[{reps:'10',kg:'100'}]}], notes:'' }, // 1000 kg
      { id:'l2', date:'2026-08-05', status:'registrato', dayKey:'A', dayName:'A', exercises:[{name:'Panca', sets:[{reps:'10',kg:'50'}]}], notes:'' },  // 500 kg
      { id:'l3', date:'2026-08-06', status:'registrato', dayKey:'A', dayName:'A', exercises:[{name:'Panca', sets:[{reps:'10',kg:'50'}]}], notes:'' },  // 500 kg
      { id:'l4', date:'2026-08-08', status:'registrato', dayKey:'A', dayName:'A', exercises:[{name:'Panca', sets:[{reps:'10',kg:'100'}]}], notes:'' }, // 1000 kg
      { id:'l5', date:'2026-08-10', status:'saltato', dayKey:null, dayName:null, exercises:[], notes:'' }
    ]))};
    state.profiles = [profilo]; activeProfileId = 'io';
    _calMese = new Date(2026, 7, 1);
    renderCalendarioStorico();
  `);
  const testo = document.getElementById('riepilogoGrid').textContent;
  assert.match(testo, /4/, 'allenamenti totali: 4 log registrati (il saltato non conta)');
  assert.match(testo, /3.000|3000/, 'volume totale: 1000+500+500+1000 = 3000 kg');
  assert.match(testo, /3/, 'miglior streak: 3 giorni consecutivi (4,5,6 agosto)');
  assert.match(testo, /non ancora tracciato/i, 'nessuno di questi log ha una durata: il tempo speso non va inventato');
  assert.equal(document.getElementById('riepilogoTitolo').textContent, 'Riepilogo Agosto 2026');
  window.close();
});

test('riepilogo mensile: quando almeno un log ha una durata tracciata, il tempo speso del mese si somma e si mostra', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConLog([
      { id:'l1', date:'2026-08-04', status:'registrato', durataMinuti: 45, dayKey:'A', dayName:'A', exercises:[], notes:'' },
      { id:'l2', date:'2026-08-05', status:'registrato', durataMinuti: 90, dayKey:'A', dayName:'A', exercises:[], notes:'' }
    ]))};
    state.profiles = [profilo]; activeProfileId = 'io';
    _calMese = new Date(2026, 7, 1);
    renderCalendarioStorico();
  `);
  // 45+90 = 135 min = 2h 15min
  assert.match(document.getElementById('riepilogoGrid').textContent, /2h 15min/);
  window.close();
});

function giornoSemplice(nomeEsercizio){
  return { key:'A', name:'Petto', weekday:'Martedì', exercises:[{ name:nomeEsercizio, sets:1, reps:'5', muscles:['Petto'] }] };
}

test('cronometro: selezionare un giorno vero avvia il conteggio, e salvare registra la durata reale trascorsa', async () => {
  const { window } = await loadApp();
  await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{}, logs:[],
      programs: [{ id:'p1', days:[${JSON.stringify(giornoSemplice('Panca Piana'))}] }], activeProgramId:'p1'
    };
    state.profiles = [profilo]; activeProfileId = 'io';
  `);
  const r = await run(window, `
    logDateInput.value = '2026-08-04';
    selectDay('A');
    const partito = _logIniziatoAlle !== null;
    // simulo 12 minuti trascorsi, senza aspettare per davvero nel test
    _logIniziatoAlle = new Date(Date.now() - 12*60*1000).toISOString();
    const repsInput = document.querySelector('.exercise-block input[data-ex="Panca Piana"][data-idx="0"][data-field="reps"]');
    const kgInput = document.querySelector('.exercise-block input[data-ex="Panca Piana"][data-idx="0"][data-field="kg"]');
    repsInput.value = '10'; repsInput.dispatchEvent(new window.Event('input', {bubbles:true}));
    kgInput.value = '80'; kgInput.dispatchEvent(new window.Event('input', {bubbles:true}));
    document.getElementById('saveLogBtn').click();
    const prof = activeProfile();
    return { partito, durata: prof.logs[0].durataMinuti };
  `);
  assert.equal(r.partito, true, 'scegliendo un giorno (non Saltato) il cronometro deve partire');
  assert.equal(r.durata, 12);
  window.close();
});

test('cronometro: scegliendo "Saltato" non parte nessun cronometro e il log salvato non ha una durata', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{}, logs:[],
      programs: [{ id:'p1', days:[${JSON.stringify(giornoSemplice('Panca Piana'))}] }], activeProgramId:'p1'
    };
    state.profiles = [profilo]; activeProfileId = 'io';
    logDateInput.value = '2026-08-04';
    selectDay('SKIP');
    const timerDopoSkip = _logIniziatoAlle;
    document.getElementById('saveLogBtn').click();
    const prof = activeProfile();
    return { timerDopoSkip, log: prof.logs[0] };
  `);
  assert.equal(r.timerDopoSkip, null);
  assert.equal(r.log.status, 'saltato');
  assert.equal('durataMinuti' in r.log, false, 'un giorno saltato non ha nessun allenamento: nessuna durata da registrare');
  window.close();
});

test('editor scheda: la categoria scelta per un giorno si salva su editingDays, quella di default resta "Nessuna"', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [{ key:'A', name:'Petto', weekday:'Lunedì', exercises:[] }];
    renderDayEditors();
  `);
  const select = document.querySelector('.dcategoria[data-di="0"]');
  assert.equal(select.value, '', 'un giorno senza categoria mai impostata deve mostrare "Nessuna" (nessuna categoria indovinata)');

  await run(window, `
    const sel = document.querySelector('.dcategoria[data-di="0"]');
    sel.value = 'cardio';
    sel.dispatchEvent(new window.Event('change', {bubbles:true}));
  `);
  const salvato = await run(window, `return editingDays[0].categoria;`);
  assert.equal(salvato, 'cardio');
  window.close();
});
