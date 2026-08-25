'use strict';
// Nuove card della Dashboard (mockup del 25/08/2026), dopo la card
// "Prossimo allenamento": striscia dei giorni della settimana, "Scheda
// attiva" e "Dieta di oggi". Questi test controllano le tre funzioni di
// rendering, non solo che le card esistano nel DOM.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('renderHomeDayStrip: mostra 7 giorni, uno solo evidenziato come "oggi"', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    renderHomeDayStrip({}, null);
    const celle = document.querySelectorAll('#homeDayStrip .home-day-cell');
    const oggi = document.querySelectorAll('#homeDayStrip .home-day-cell.oggi');
    return { totale: celle.length, evidenziati: oggi.length };
  `);
  assert.equal(r.totale, 7);
  assert.equal(r.evidenziati, 1, 'un solo giorno deve essere evidenziato come "oggi"');
  window.close();
});

test('renderHomeSchedaAttiva: senza scheda attiva la card resta nascosta, con una scheda mostra il suo nome', async () => {
  const { window, document } = await loadApp();
  await run(window, `renderHomeSchedaAttiva(null);`);
  assert.equal(document.getElementById('homeSchedaAttivaCard').style.display, 'none');

  await run(window, `renderHomeSchedaAttiva({ id:'p1', name:'Ipertrofia Fase 2' });`);
  assert.equal(document.getElementById('homeSchedaAttivaCard').style.display, 'flex');
  assert.equal(document.getElementById('homeSchedaAttivaNome').textContent, 'Ipertrofia Fase 2');
  window.close();
});

test('homeSchedaAttivaCard: al tocco porta alla Scheda', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{},
      programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
        days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
      activeProgramId:'p1', mealLogs:[]
    };
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('homeSchedaAttivaCard').click();
  `);
  assert.equal(document.getElementById('appRoot').style.display, 'block');
  assert.ok(document.getElementById('view-program').classList.contains('active'));
  window.close();
});

test('renderHomeDietaOggi: senza dati per il fabbisogno mostra solo i kcal consumati oggi, senza barra', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const prof = { mealLogs: [{ date: new Date().toISOString().slice(0,10), items: [
      { food: 'riso bianco', grams: 100 }
    ] }] };
    renderHomeDietaOggi(prof);
  `);
  assert.match(document.getElementById('homeDietaOggiKcal').textContent, /^353 kcal$/, 'senza fabbisogno calcolabile mostra solo i kcal consumati');
  assert.equal(document.querySelector('#homeDietaOggiBody .home-dieta-kcal-bar'), null, 'senza fabbisogno non deve inventare una barra di completamento');
  const righeMacro = document.querySelectorAll('#homeDietaOggiBody .macro-row');
  assert.equal(righeMacro.length, 3, 'proteine, carboidrati, grassi');
  assert.match(righeMacro[1].textContent, /80 g/, 'i carboidrati del riso bianco (80g/100g) devono comparire');
  window.close();
});

test('renderHomeDietaOggi: con tutti i dati per il fabbisogno mostra anche la barra kcal/obiettivo', async () => {
  const { window, document } = await loadApp();
  const oggi = new Date().toISOString().slice(0,10);
  const r = await run(window, `
    const prof = {
      sesso: 'uomo', dataNascita: '1995-01-01', altezza: 180,
      measurements: [{ date: '2026-08-01', weight: 80 }],
      livelloAttivita: 'moderato', obiettivoCalorico: 'mantenimento',
      mealLogs: [{ date: '${oggi}', items: [{ food: 'riso bianco', grams: 100 }] }]
    };
    renderHomeDietaOggi(prof);
    return { kcalTxt: document.getElementById('homeDietaOggiKcal').textContent, barraCe: !!document.querySelector('#homeDietaOggiBody .home-dieta-kcal-bar') };
  `);
  assert.match(r.kcalTxt, /^353 \/ \d+ kcal$/, 'con fabbisogno calcolabile mostra "consumati / obiettivo"');
  assert.equal(r.barraCe, true);
  window.close();
});
