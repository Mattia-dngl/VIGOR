'use strict';
// 31/08/2026: due segnalazioni collegate, stessa causa di fondo (lo stato di
// Registra non veniva mai riportato a "pulito" rientrando dal menu del "+"):
//  1) il cronometro allenamento a volte continuava dal tempo di una sessione
//     precedente invece di azzerarsi (es. riaprendo "Allenamento libero" dal
//     "+" quando era già quello il giorno scelto: selectDay('LIBERO') non
//     cambiava "giorno" rispetto a prima, quindi non toccava più il
//     cronometro — vedi selectDay).
//  2) da "Allenamento libero" a "Registra allenamento" (segui scheda) si
//     restava bloccati sulla vista di Allenamento libero: nulla riportava
//     selectedDayKey a "nessun giorno scelto" rientrando da lì.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

// weekday volutamente diverso da oggi (31/08/2026 è un lunedì): altrimenti
// renderDayChoices() suggerirebbe da sola il giorno di oggi come previsto
// dalla scheda, cosa corretta ma che renderebbe non deterministico il test
// "torna alla scelta del giorno" (deve tornare al placeholder vuoto, non a
// un giorno auto-scelto).
function profiloConDati(extra){
  return Object.assign({
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[{date:'2026-08-01', weight:80}],
    customExercises:{}, customFoods:{}, mealLogs:[], waterLogs:[],
    sesso:'uomo', dataNascita:'1995-06-15', altezza:180, livelloAttivita:'moderato', obiettivoCalorico:'mantenimento',
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Mercoledì', exercises:[{name:'Panca piana', sets:3, reps:'8-10'}]}], dietInfo:{}, diet:{} }],
    activeProgramId:'p1'
  }, extra||{});
}

test('Cronometro: riselezionando "Allenamento libero" già attivo dal menu del "+" riparte da zero', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabOptLibero').click();
  `);
  // simulo un'ora già trascorsa, come se la scheda fosse rimasta aperta a lungo
  await run(window, `_logIniziatoAlle = new Date(Date.now() - 3600000).toISOString();`);
  await run(window, `document.getElementById('fabOptLibero').click();`);
  const r = await run(window, `return { iniziatoAlle: _logIniziatoAlle };`);
  const secondiFa = (Date.now() - new Date(r.iniziatoAlle).getTime())/1000;
  assert.ok(secondiFa < 5, `il cronometro deve ripartire da adesso, non continuare da un\'ora fa (era a ${secondiFa}s)`);
  window.close();
});

test('Cronometro: scegliere un giorno diverso continua ad azzerare il cronometro come prima', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriRegistra();
    selectDay('A');
  `);
  const r = await run(window, `return { iniziatoAlle: _logIniziatoAlle };`);
  assert.ok(r.iniziatoAlle, 'deve essere impostato scegliendo un giorno vero');
  const secondiFa = (Date.now() - new Date(r.iniziatoAlle).getTime())/1000;
  assert.ok(secondiFa < 5);
  window.close();
});

test('"Registra allenamento" dal menu del "+" riporta alla scelta del giorno se si arriva da un Allenamento libero senza dati', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    // Data fissa (un lunedì, diverso dal Mercoledì di Giorno A): altrimenti
    // "tornare al placeholder" può fallire il giorno in cui gira davvero il
    // test, se per caso è proprio un mercoledì (successo con lo stesso bug
    // già corretto altrove — vedi banner-stato-registra-31-08.test.js).
    document.getElementById('logDate').value = '2026-01-05';
    document.getElementById('fabOptLibero').click();
  `);
  let r = await run(window, `return { selezionato: selectedDayKey };`);
  assert.equal(r.selezionato, 'LIBERO', 'precondizione: siamo su Allenamento libero');

  await run(window, `document.getElementById('fabOptAllenamento').click();`);
  r = await run(window, `return {
    selezionato: selectedDayKey,
    valoreTendina: document.getElementById('dayChoiceChips').value,
    exerciseFormVisibile: document.getElementById('exerciseFormCard').style.display,
    freeBtnVisibile: document.getElementById('freeAddExBtn').style.display
  };`);
  assert.equal(r.selezionato, null, 'non deve restare bloccato su Allenamento libero');
  assert.equal(r.valoreTendina, '', 'la tendina deve tornare al placeholder, non restare su un valore invalido');
  assert.equal(r.exerciseFormVisibile, 'none');
  assert.equal(r.freeBtnVisibile, 'none', 'i controlli di Allenamento libero non devono restare a vista senza un giorno scelto');
  window.close();
});

test('"Registra allenamento" chiede conferma prima di abbandonare un Allenamento libero con dati non ancora salvati', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('logDate').value = '2026-01-05';
    document.getElementById('fabOptLibero').click();
    const prof = activeProfile();
    prof.bozzaLog = { programId: prof.programs[0].id, dayKey:'LIBERO',
      serie: { 'Flessioni': [{reps:'12', kg:'', seconds:''}] }, note:'', quando: new Date().toISOString(),
      iniziatoAlle: _logIniziatoAlle };
  `);
  await run(window, `document.getElementById('fabOptAllenamento').click();`);
  let r = await run(window, `return {
    haConferma: !!document.getElementById('customConfirmOk'),
    selezionato: selectedDayKey
  };`);
  assert.ok(r.haConferma, 'deve chiedere conferma invece di buttare via i dati in silenzio');
  assert.equal(r.selezionato, 'LIBERO', 'finché non si conferma, resta dov\'era');

  await run(window, `document.getElementById('customConfirmOk').click();`);
  r = await run(window, `return { selezionato: selectedDayKey, bozza: activeProfile().bozzaLog };`);
  assert.equal(r.selezionato, null);
  assert.equal(r.bozza, null, 'confermando, l\'allenamento libero non salvato viene scartato');
  window.close();
});
