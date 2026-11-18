'use strict';
// 18/11/2026 — cronometro allenamento: "ogni tanto mostra già un tempo".
// Regole volute dall'utente:
//  - il cronometro parte da zero SOLO quando Registra è davvero aperta (prima
//    partiva appena si sceglieva il giorno, anche in sottofondo al login);
//  - chiudendo Registra senza salvare si spegne (insieme al timer di recupero);
//  - riaprendola riparte da zero, anche se i dati inseriti restano in bozza;
//  - una bozza ripristinata non ridà vita al vecchio orario di inizio.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

const PROFILO = `
  const profilo = {
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{},
    sesso:'uomo', programs:[{ id:'p1', days:[{ key:'A', name:'Petto', weekday:'Mercoledì',
      exercises:[{ name:'Panca Piana', sets:2, reps:'8', muscles:['Petto'] }] }] }], activeProgramId:'p1'
  };
  state.profiles = [profilo]; activeProfileId = 'io';
  document.getElementById('logDate').value = '2026-01-05';
`;
const secondiFa = (iso) => (Date.now() - new Date(iso).getTime()) / 1000;

test('Cronometro: scegliere il giorno con Registra chiusa (es. in sottofondo al login) NON lo fa partire', async () => {
  const { window } = await loadApp();
  await run(window, PROFILO + `mostraHome(); selectDay('A');`);
  const r = await run(window, `return { inizio: _logIniziatoAlle, card: document.getElementById('workoutTimerCard').style.display };`);
  assert.equal(r.inizio, null);
  assert.equal(r.card, 'none');
  window.close();
});

test('Cronometro: aprendo Registra con un giorno già scelto parte da zero, non da un tempo già trascorso', async () => {
  const { window } = await loadApp();
  await run(window, PROFILO + `mostraHome(); selectDay('A');`);
  await run(window, `apriRegistra();`);
  const r = await run(window, `return { inizio: _logIniziatoAlle, card: document.getElementById('workoutTimerCard').style.display,
                                         testo: document.getElementById('workoutTimerDisplay').textContent };`);
  assert.ok(r.inizio, 'deve partire aprendo Registra');
  assert.ok(secondiFa(r.inizio) < 5);
  assert.equal(r.card, 'block');
  assert.equal(r.testo, '0:00');
  window.close();
});

test('Cronometro: chiudendo Registra senza salvare si spegne, e riaprendola riparte da zero (i dati restano)', async () => {
  const { window, document } = await loadApp();
  await run(window, PROFILO + `apriRegistra(); selectDay('A');`);
  // un'ora "trascorsa" e un dato inserito
  await run(window, `
    _logIniziatoAlle = new Date(Date.now() - 3600000).toISOString();
    const i = document.querySelector('.exercise-block input[data-field="reps"]');
    i.value = '8'; i.dispatchEvent(new window.Event('input', {bubbles:true}));
  `);
  await run(window, `document.getElementById('registraTornaSchedaBtn').click();`);   // chiude Registra
  let r = await run(window, `return { inizio: _logIniziatoAlle, card: document.getElementById('workoutTimerCard').style.display };`);
  assert.equal(r.inizio, null, 'chiusa Registra il cronometro deve spegnersi');
  assert.equal(r.card, 'none');

  await run(window, `apriRegistra();`);
  r = await run(window, `return { inizio: _logIniziatoAlle, reps: currentSetInputs['Panca Piana'][0].reps };`);
  assert.ok(secondiFa(r.inizio) < 5, 'riaprendola riparte da zero, non da un\'ora fa');
  assert.equal(r.reps, '8', 'i dati inseriti non si perdono');
  window.close();
});

test('Cronometro: chiudendo Registra si ferma anche il timer di recupero', async () => {
  const { window } = await loadApp();
  await run(window, PROFILO + `apriRegistra(); selectDay('A'); timerAvvia(90);`);
  assert.ok(await run(window, `return _timerFine !== null;`), 'precondizione: il recupero sta contando');
  await run(window, `document.getElementById('registraTornaSchedaBtn').click();`);
  assert.equal(await run(window, `return _timerFine;`), null, 'uscendo da Registra il recupero non deve restare in corso');
  window.close();
});

test('Cronometro: uscire verso la Home spegne il cronometro', async () => {
  const { window } = await loadApp();
  await run(window, PROFILO + `apriRegistra(); selectDay('A');`);
  assert.ok(await run(window, `return !!_logIniziatoAlle;`));
  await run(window, `mostraHome();`);
  assert.equal(await run(window, `return _logIniziatoAlle;`), null);
  window.close();
});

test('Cronometro: una bozza con un vecchio orario di inizio non lo fa risorgere (né al ripristino né aprendo Registra)', async () => {
  const { window } = await loadApp();
  await run(window, PROFILO + `
    mostraHome();
    const prof = activeProfile();
    prof.bozzaLog = { programId:'p1', data:'2026-01-05', dayKey:'A', liberi:null,
      serie: { 'Panca Piana': [{reps:'8', kg:'60', seconds:''}, {reps:'', kg:'', seconds:''}] },
      note:'', quando:new Date().toISOString(), iniziatoAlle: new Date(Date.now() - 5*3600000).toISOString(),
      allenamentoATempo:false, allenamentoATempoBloccato:true };
    _bozzaPronta = false; ripristinaBozza(); _bozzaPronta = true;
  `);
  let r = await run(window, `return { inizio: _logIniziatoAlle, reps: currentSetInputs['Panca Piana'][0].reps };`);
  assert.equal(r.inizio, null, 'ripristinata in sottofondo: nessun cronometro, soprattutto non quello di 5 ore fa');
  assert.equal(r.reps, '8', 'i dati della bozza invece ci sono');
  await run(window, `apriRegistra();`);
  r = await run(window, `return { inizio: _logIniziatoAlle };`);
  assert.ok(secondiFa(r.inizio) < 5, 'aprendo Registra parte da zero');
  window.close();
});

test('Cronometro: la durata salvata conta dal momento in cui Registra è stata aperta', async () => {
  const { window } = await loadApp();
  await run(window, PROFILO + `apriRegistra(); selectDay('A');`);
  const durata = await run(window, `
    _logIniziatoAlle = new Date(Date.now() - 7*60000).toISOString();
    const i = document.querySelector('.exercise-block input[data-field="reps"]');
    i.value = '8'; i.dispatchEvent(new window.Event('input', {bubbles:true}));
    document.getElementById('saveLogBtn').click();
    return activeProfile().logs[0].durataMinuti;
  `);
  assert.equal(durata, 7);
  window.close();
});
