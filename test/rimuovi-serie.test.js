'use strict';
// Bug segnalato dall'utente (01/09/2026): in Allenamento libero, scegliendo
// un esercizio l'app inserisce sempre 3 serie di default, ma non c'era modo
// di toglierne una per farne, es., solo 1 — mancava del tutto un tasto per
// rimuovere una singola serie (c'era solo "+ Aggiungi serie", mai il
// contrario). Il bug riguardava tutta Registra, non solo Allenamento libero:
// lo stesso addSetRow()/set-row è condiviso anche dai giorni di scheda veri.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(overrides){
  return Object.assign({
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[],
    customExercises:{}, customFoods:{}, mealLogs:[],
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[
        { name:'Panca Piana', sets:3, reps:'8-10', muscles:[] }
      ]}], dietInfo:{}, diet:{} }],
    activeProgramId:'p1'
  }, overrides||{});
}

test('Allenamento libero: scegliere un esercizio inserisce 3 serie, ognuna col tasto per toglierla', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabOptLibero').click();
    freeAddExercise({ n:'Curl con bilanciere', g:'Bicipiti' });
  `);
  const righe = document.querySelectorAll('.exercise-block .set-row');
  assert.equal(righe.length, 3, 'di default devono comparire 3 serie');
  righe.forEach(r=> assert.ok(r.querySelector('.set-remove-btn'), 'ogni serie normale deve avere il tasto per toglierla'));
  window.close();
});

test('togliere una serie la fa sparire, ne restano 2 correttamente rinumerate (1, 2)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabOptLibero').click();
    freeAddExercise({ n:'Curl con bilanciere', g:'Bicipiti' });
    document.querySelectorAll('.exercise-block .set-row')[0].querySelector('.set-remove-btn').click();
  `);
  const righe = document.querySelectorAll('.exercise-block .set-row');
  assert.equal(righe.length, 2);
  const numeri = Array.from(righe).map(r=>r.querySelector('.set-num').textContent);
  assert.deepEqual(numeri, ['1','2']);
  const r = await run(window, `return currentSetInputs['Curl con bilanciere'].length;`);
  assert.equal(r, 2, 'anche i dati salvati devono restare in 2, non solo il DOM');
  window.close();
});

test('con una sola serie rimasta il tasto per toglierla sparisce (non si può restare a 0 serie)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabOptLibero').click();
    freeAddExercise({ n:'Curl con bilanciere', g:'Bicipiti' });
    let righe = document.querySelectorAll('.exercise-block .set-row');
    righe[0].querySelector('.set-remove-btn').click();
    righe = document.querySelectorAll('.exercise-block .set-row');
    righe[0].querySelector('.set-remove-btn').click();
  `);
  const righe = document.querySelectorAll('.exercise-block .set-row');
  assert.equal(righe.length, 1, 'deve restare almeno 1 serie');
  const btn = righe[0].querySelector('.set-remove-btn');
  assert.equal(btn.style.display, 'none', 'con una sola serie il tasto per toglierla deve sparire');
  window.close();
});

test('i valori delle serie restanti non si mescolano dopo aver tolto una serie in mezzo', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabOptLibero').click();
    freeAddExercise({ n:'Curl con bilanciere', g:'Bicipiti' });
    const righe = document.querySelectorAll('.exercise-block .set-row');
    // serie 1: 10x20 — serie 2: 8x22 (verrà tolta) — serie 3: 6x24
    const scrivi = (riga, reps, kg) => {
      const inpReps = riga.querySelector('[data-field="reps"]');
      const inpKg = riga.querySelector('[data-field="kg"]');
      inpReps.value = reps; inpReps.dispatchEvent(new Event('input', {bubbles:true}));
      inpKg.value = kg; inpKg.dispatchEvent(new Event('input', {bubbles:true}));
    };
    scrivi(righe[0], '10', '20');
    scrivi(righe[1], '8', '22');
    scrivi(righe[2], '6', '24');
    righe[1].querySelector('.set-remove-btn').click();
  `);
  const r = await run(window, `return currentSetInputs['Curl con bilanciere'];`);
  assert.equal(r.length, 2);
  assert.equal(r[0].reps, '10'); assert.equal(r[0].kg, '20');
  assert.equal(r[1].reps, '6'); assert.equal(r[1].kg, '24');
  window.close();
});

test('"segna fatta" sulla serie giusta anche dopo aver tolto una serie precedente (niente indice sbagliato)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabOptLibero').click();
    freeAddExercise({ n:'Curl con bilanciere', g:'Bicipiti' });
    let righe = document.querySelectorAll('.exercise-block .set-row');
    righe[0].querySelector('.set-remove-btn').click();   // resta la ex-2ª e ex-3ª, ora agli indici 0 e 1
    righe = document.querySelectorAll('.exercise-block .set-row');
    righe[1].querySelector('.set-fatta-btn').click();     // segna "fatta" la seconda riga rimasta
  `);
  const r = await run(window, `return currentSetInputs['Curl con bilanciere'].map(s=>!!s._fatta);`);
  assert.deepEqual(r, [false, true], 'deve risultare fatta la riga giusta (indice 1), non quella sbagliata');
  window.close();
});

test('scheda vera (non Allenamento libero): stesso tasto per togliere una serie sulle 3 di default', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriRegistra();
    selectDay('A');
  `);
  let righe = document.querySelectorAll('.exercise-block .set-row');
  assert.equal(righe.length, 3);
  await run(window, `document.querySelectorAll('.exercise-block .set-row')[0].querySelector('.set-remove-btn').click();`);
  righe = document.querySelectorAll('.exercise-block .set-row');
  assert.equal(righe.length, 2);
  window.close();
});

test('un esercizio con dropset attivo: le righe di round non hanno il tasto × (si gestiscono da "Tecnica speciale")', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabOptLibero').click();
    freeAddExercise({ n:'Curl con bilanciere', g:'Bicipiti' });
    document.querySelector('.seg-toggle-tecnica .seg-btn[data-tecnica="dropset"]').click();
  `);
  const righe = document.querySelectorAll('.exercise-block .set-row');
  assert.ok(righe.length >= 2, 'principale + almeno un drop');
  righe.forEach(r=> assert.ok(!r.querySelector('.set-remove-btn'), 'le righe di un round dropset non devono avere il tasto ×'));
  window.close();
});
