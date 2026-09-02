'use strict';
// Richiesta esplicita dell'utente (proposte di miglioramento, 01/09/2026):
// il PT imposta su un esercizio una regola ("+2,5 kg a settimana"), e il
// cliente vede il peso già calcolato per la settimana in corso, senza dover
// fare i conti — la progressione continua SEMPRE, anche se il cliente non
// ha completato tutte le serie previste (scelta esplicita dell'utente).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(overrides){
  return Object.assign({
    id: 'io', name: 'Io', email: 'io@test.it', createdAt:'2026-01-01', logs: [], measurements: [],
    customExercises: {}, customFoods: {}, mealLogs: [],
    programs: [{
      id:'p1', name:'Programma', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      durataSettimane:null, dataInizio:'2026-01-01', notePT:null,
      days:[
        { key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null, exercises:[
          { name:'Panca Piana', sets:3, reps:'10', recupero:null, muscles:[] },
          { name:'Piegamenti (push-up)', sets:3, reps:'12', recupero:null, muscles:[] }
        ] }
      ],
      dietInfo:{}, diet:{}
    }],
    activeProgramId: 'p1'
  }, overrides || {});
}

// ---------------------------------------------------------------
// calcolo puro
// ---------------------------------------------------------------

test('pesoProgressivo: senza progressione attiva restituisce null', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return {
      niente: pesoProgressivo({name:'Panca Piana'}, {dataInizio:'2026-01-01'}),
      spenta: pesoProgressivo({name:'Panca Piana', progressione:{attiva:false, base:40, incremento:2.5}}, {dataInizio:'2026-01-01'}),
    };
  `);
  assert.equal(r.niente, null);
  assert.equal(r.spenta, null);
});

test('pesoProgressivo: calcola base + incremento*settimane trascorse (kg)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const dataInizio = new Date(Date.now() - 3*604800000 - 86400000).toISOString().slice(0,10); // 3 settimane e un giorno fa
    const ex = { name:'Panca Piana', progressione:{ attiva:true, base:40, incremento:2.5, unita:'kg' } };
    return pesoProgressivo(ex, { dataInizio });
  `);
  assert.equal(r, 47.5, '40 + 2.5*3 settimane complete = 47.5');
});

test('pesoProgressivo: con unità "percento" cresce in percentuale composta sulla base', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const dataInizio = new Date(Date.now() - 2*604800000 - 86400000).toISOString().slice(0,10);
    const ex = { name:'Panca Piana', progressione:{ attiva:true, base:100, incremento:5, unita:'percento' } };
    return pesoProgressivo(ex, { dataInizio });
  `);
  assert.equal(r, 110, '100 * (1 + 0.05*2) = 110');
});

test('pesoProgressivo: continua a salire anche se il cliente non ha registrato nulla in mezzo (nessuna dipendenza dai log)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const dataInizio = new Date(Date.now() - 4*604800000 - 86400000).toISOString().slice(0,10);
    const ex = { name:'Panca Piana', progressione:{ attiva:true, base:20, incremento:1, unita:'kg' } };
    // Nessun prof.logs passato alla funzione: la formula non guarda affatto
    // lo storico, solo la data di inizio scheda — la progressione non può
    // quindi "fermarsi" per allenamenti saltati o incompleti.
    return pesoProgressivo(ex, { dataInizio });
  `);
  assert.equal(r, 24);
});

// ---------------------------------------------------------------
// editor scheda (PT)
// ---------------------------------------------------------------

test('editor scheda: la sezione "Progressione automatica" esiste solo per esercizi con un campo kg', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('schedaEditBtn').click();
  `);
  const blocchi = document.querySelectorAll('.exercise-edit-block');
  assert.equal(blocchi.length, 2);
  // "Panca Piana" (tipo peso, ha reps+kg) la deve avere
  const riassuntiPanca = Array.from(blocchi[0].querySelectorAll('.ex-sub-titolo')).map(e=>e.textContent);
  assert.ok(riassuntiPanca.includes('Progressione automatica'));
  // "Piegamenti (push-up)" (tipo corpo, solo reps) NON la deve avere
  const riassuntiPushup = Array.from(blocchi[1].querySelectorAll('.ex-sub-titolo')).map(e=>e.textContent);
  assert.ok(!riassuntiPushup.includes('Progressione automatica'));
  window.close();
});

test('editor scheda: attivare la spunta e compilare i campi salva ex.progressione', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('schedaEditBtn').click();
    document.querySelector('.prog-attiva').click();
  `);
  assert.ok(document.querySelector('.prog-base'), 'dopo la spunta devono comparire i campi');
  await run(window, `
    document.querySelector('.prog-base').value = '42.5';
    document.querySelector('.prog-base').dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.prog-incremento').value = '2.5';
    document.querySelector('.prog-incremento').dispatchEvent(new Event('input', {bubbles:true}));
    document.querySelector('.prog-unita').value = 'kg';
    document.querySelector('.prog-unita').dispatchEvent(new Event('change', {bubbles:true}));
  `);
  const r = await run(window, `return editingDays[0].exercises[0].progressione;`);
  assert.deepEqual(r, { attiva:true, base:42.5, incremento:2.5, unita:'kg' });
  window.close();
});

test('editor scheda: togliendo la spunta i campi spariscono di nuovo', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('schedaEditBtn').click();
    document.querySelector('.prog-attiva').click();
    document.querySelector('.prog-attiva').click();
  `);
  assert.ok(!document.querySelector('.prog-base'));
  window.close();
});

// ---------------------------------------------------------------
// Registra (cliente)
// ---------------------------------------------------------------

test('Registra: mostra il peso suggerito quando l\'esercizio ha una progressione attiva', async () => {
  const { window, document } = await loadApp();
  const profilo = profiloBase();
  profilo.programs[0].days[0].exercises[0].progressione = { attiva:true, base:40, incremento:2.5, unita:'kg' };
  await run(window, `
    const profilo = ${JSON.stringify(profilo)};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriRegistra();
    selectDay('A');
  `);
  const blocco = document.querySelector('.exercise-block');
  assert.match(blocco.innerHTML, /Suggerito questa settimana/);
  window.close();
});

test('Registra: nessun suggerimento per un esercizio senza progressione impostata', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriRegistra();
    selectDay('A');
  `);
  const blocco = document.querySelector('.exercise-block');
  assert.ok(!blocco.innerHTML.includes('Suggerito questa settimana'));
  window.close();
});
