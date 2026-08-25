'use strict';
// Test dei "record personali" (PR) in Registra/Storico: prima il massimale
// stimato (formula di Epley) si vedeva solo dentro il grafico di Storico,
// mai segnalato al momento in cui veniva battuto davvero. Ora:
//  1) recordPersonale(prof, esercizio) calcola il record al volo dai log
//     (stessa fonte di verità del grafico, nessun dato duplicato da tenere
//     sincronizzato)
//  2) Storico mostra il record corrente sopra il grafico per l'esercizio
//     selezionato
//  3) salvando un allenamento che batte un record VERO già esistente parte
//     un avviso dedicato ("🏆 Nuovo record..."), in coda a quello normale
//     di salvataggio (toast() ha un solo slot, vedi index.html)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('recordPersonale: prende il massimale stimato (Epley) più alto fra tutti i log, con la sua data', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
      logs: [
        { id:'l1', date:'2026-01-01', exercises:[{ name:'Panca Piana', sets:[{reps:'5', kg:'80'}] }] },   // epley 93.3
        { id:'l2', date:'2026-01-08', exercises:[{ name:'Panca Piana', sets:[{reps:'10', kg:'70'}] }] },  // epley 93.3 (uguale, non batte)
        { id:'l3', date:'2026-01-15', exercises:[{ name:'Panca Piana', sets:[{reps:'3', kg:'90'}] }] }    // epley 99 (record vero)
      ]
    };
    return recordPersonale(profilo, 'Panca Piana');
  `);
  assert.equal(r.valore, 99);
  assert.equal(r.data, '2026-01-15');
  window.close();
});

test('recordPersonale: null se l\'esercizio non è mai stato registrato', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
      logs: [{ id:'l1', date:'2026-01-01', exercises:[{ name:'Squat', sets:[{reps:'5', kg:'80'}] }] }] };
    return recordPersonale(profilo, 'Panca Piana');
  `);
  assert.equal(r, null);
  window.close();
});

test('Storico: il record personale dell\'esercizio selezionato compare sopra il grafico', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
      logs: [
        { id:'l1', date:'2026-01-01', exercises:[{ name:'Panca Piana', sets:[{reps:'5', kg:'80'}] }] },
        { id:'l2', date:'2026-01-15', exercises:[{ name:'Panca Piana', sets:[{reps:'3', kg:'90'}] }] }
      ]
    };
    state.profiles = [profilo]; activeProfileId = 'io';
    renderProgressSelect();
    document.getElementById('progressExerciseSelect').value = 'Panca Piana';
    renderProgressTable();
    const box = document.getElementById('recordPersonale');
    return { visibile: box.style.display !== 'none', testo: box.textContent };
  `);
  assert.equal(r.visibile, true);
  assert.match(r.testo, /99/, 'deve mostrare il valore del record (99 kg stimati)');
  assert.match(r.testo, /stimato/i, 'deve chiarire che è una stima (formula di Epley), non un peso realmente sollevato');
  window.close();
});

test('Storico: per un esercizio a tempo (es. plank) il record NON è etichettato "stimato", perché è un tempo misurato per davvero', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
      logs: [ { id:'l1', date:'2026-01-01', exercises:[{ name:'Plank', sets:[{seconds:'60'}] }] } ]
    };
    state.profiles = [profilo]; activeProfileId = 'io';
    renderProgressSelect();
    document.getElementById('progressExerciseSelect').value = 'Plank';
    renderProgressTable();
    const box = document.getElementById('recordPersonale');
    return { testo: box.textContent };
  `);
  assert.match(r.testo, /60 sec/);
  assert.ok(!/stimato/i.test(r.testo), 'il tempo tenuto in plank è misurato davvero, non va etichettato come stima');
  window.close();
});

function giornoSemplice(nomeEsercizio){
  return { key:'A', name:'Petto', weekday:'Lunedì', exercises:[{ name:nomeEsercizio, sets:1, reps:'5', muscles:['Petto'] }] };
}

function programmaMinimo(nomeEsercizio, logPrecedenti){
  return {
    id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
    logs: logPrecedenti,
    programs: [{ id:'p1', days:[giornoSemplice(nomeEsercizio)] }], activeProgramId:'p1'
  };
}

// compila e salva un'unica serie (reps/kg) per l'esercizio del giorno "A"
async function compilaESalva(window, nomeEsercizio, reps, kg){
  return run(window, `
    logDateInput.value = '2026-02-01';
    selectDay('A');
    const repsInput = document.querySelector('.exercise-block input[data-ex="${nomeEsercizio}"][data-idx="0"][data-field="reps"]');
    const kgInput = document.querySelector('.exercise-block input[data-ex="${nomeEsercizio}"][data-idx="0"][data-field="kg"]');
    repsInput.value = '${reps}'; repsInput.dispatchEvent(new window.Event('input', {bubbles:true}));
    kgInput.value = '${kg}'; kgInput.dispatchEvent(new window.Event('input', {bubbles:true}));

    const originale = toast;
    let messaggi = [];
    window.toast = function(msg){ messaggi.push(msg); return originale(msg); };

    document.getElementById('saveLogBtn').click();
    await new Promise(res => setTimeout(res, 2600));   // il toast del record parte dopo 2500ms
    return { messaggi };
  `);
}

test('salvare un allenamento che batte un record vero festeggia con un avviso dedicato', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(programmaMinimo('Military Press', [
      { id:'l0', date:'2026-01-01', programId:'p1', status:'registrato', dayKey:'A', dayName:'Petto',
        exercises:[{ name:'Military Press', sets:[{reps:'5', kg:'40'}] }], notes:'' }
    ]))};
    state.profiles = [profilo]; activeProfileId = 'io';
    return null;
  `);
  const esito = await compilaESalva(window, 'Military Press', 5, 45); // epley 40*(1+5/30)=46.7 → 45*(1+5/30)=52.5, batte
  assert.ok(esito.messaggi.some(m => m.includes('🏆') && m.includes('Military Press')),
    'deve comparire un avviso col trofeo per il nuovo record');
  assert.ok(esito.messaggi.some(m => m.includes('🏆') && /stimato/i.test(m)),
    'anche l\'avviso al volo deve dire che è un record stimato (Epley), non un peso davvero sollevato');
  window.close();
});

test('il primo log mai registrato di un esercizio e un log che non migliora il record non festeggiano nulla', async () => {
  const { window } = await loadApp();
  await run(window, `
    const profilo = {
      id:'io', name:'Io', email:'io@test.it', measurements:[], customExercises:{}, customFoods:{},
      logs: [{ id:'l0', date:'2026-01-01', programId:'p1', status:'registrato', dayKey:'A', dayName:'Petto',
               exercises:[{ name:'Panca Piana', sets:[{reps:'5', kg:'90'}] }], notes:'' }],
      programs: [{ id:'p1', days:[{
        key:'A', name:'Petto', weekday:'Lunedì',
        exercises:[
          { name:'Squat', sets:1, reps:'5', muscles:['Gambe'] },       // mai registrato prima: niente da battere
          { name:'Panca Piana', sets:1, reps:'5', muscles:['Petto'] }  // stesso valore di prima: non migliora
        ]
      }] }], activeProgramId:'p1'
    };
    state.profiles = [profilo]; activeProfileId = 'io';
  `);
  const r = await run(window, `
    logDateInput.value = '2026-02-01';
    selectDay('A');
    const compila = (nome, reps, kg) => {
      const r = document.querySelector('.exercise-block input[data-ex="'+nome+'"][data-idx="0"][data-field="reps"]');
      const k = document.querySelector('.exercise-block input[data-ex="'+nome+'"][data-idx="0"][data-field="kg"]');
      r.value = String(reps); r.dispatchEvent(new window.Event('input', {bubbles:true}));
      k.value = String(kg); k.dispatchEvent(new window.Event('input', {bubbles:true}));
    };
    compila('Squat', 5, 60);
    compila('Panca Piana', 5, 90);   // identico al log precedente: nessun miglioramento

    const originale = toast;
    let messaggi = [];
    window.toast = function(msg){ messaggi.push(msg); return originale(msg); };

    document.getElementById('saveLogBtn').click();
    await new Promise(res => setTimeout(res, 2600));
    return { messaggi };
  `);
  assert.ok(!r.messaggi.some(m => m.includes('🏆')), 'nessun avviso di record: né una prima volta né un pareggio sono un record battuto');
  assert.ok(r.messaggi.some(m => m.includes('Allenamento salvato')), 'il salvataggio normale deve comunque essere confermato');
  window.close();
});
