'use strict';
// Modifiche del 25/08/2026 su richiesta dell'utente (con mockup Figma):
//  - Home ridiventa "Dashboard" nella nav in basso, con avatar (invece
//    dell'ingranaggio) in alto a destra che apre Account.
//  - Il bottone centrale rialzato della nav non porta più a Home: ora è un
//    "+" che apre Registra da qualunque schermata.
//  - Account e Glossario non hanno più una voce fissa nella nav: si aprono
//    da Account (raggiunto dall'avatar).
//  - Storico diventa una voce a sé della nav, invece di un segmento dentro
//    Scheda: apriStorico() mostra lo stesso contenuto di sempre
//    (programStoricoBlock) ma la nav evidenzia "Storico", non "Scheda".
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(){
  return {
    id: 'io', name: 'Io', email: 'io@test.it', logs: [], measurements: [], customExercises: {}, customFoods: {},
    programs: [{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId: 'p1', mealLogs: []
  };
}

test('nav in basso: Dashboard e Storico esistono, Account e Glossario non hanno più una voce fissa', async () => {
  const { window, document } = await loadApp();
  await run(window, `mostraHome();`);
  assert.ok(document.querySelector('#navTabsGlobale button[data-go="home"]'));
  assert.match(document.querySelector('#navTabsGlobale button[data-go="home"] .tab-label').textContent, /Dashboard/);
  assert.ok(document.querySelector('#navTabsGlobale button[data-go="storico"]'), 'Storico deve avere una voce propria');
  assert.equal(document.querySelector('#navTabsGlobale button[data-go="account"]'), null);
  assert.equal(document.querySelector('#navTabsGlobale button[data-go="glossario"]'), null);
  window.close();
});

test('il bottone centrale rialzato della nav apre Registra, non più Home', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
  `);
  assert.equal(document.getElementById('appRoot').style.display, 'block', 'Registra deve aprire appRoot');
  assert.ok(document.getElementById('view-log').classList.contains('active'), 'la vista attiva deve essere Registra (log)');
  window.close();
});

test('avatar in Dashboard apre Account (non più le Impostazioni)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('homeAvatarBtn').click();
  `);
  assert.equal(document.getElementById('accountPanel').style.display, 'block');
  window.close();
});

test('Storico: cliccando la voce in nav si apre lo stesso contenuto di sempre, ma la nav evidenzia "Storico"', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.querySelector('#navTabsGlobale button[data-go="storico"]').click();
  `);
  assert.equal(document.getElementById('appRoot').style.display, 'block');
  assert.equal(document.getElementById('programSchedaBlock').style.display, 'none');
  assert.equal(document.getElementById('programStoricoBlock').style.display, 'block');
  const btnStorico = document.querySelector('#navTabsGlobale button[data-go="storico"]');
  const btnScheda = document.querySelector('#navTabsGlobale button[data-go="program"]');
  assert.ok(btnStorico.classList.contains('active'), 'Storico deve risultare evidenziato');
  assert.ok(!btnScheda.classList.contains('active'), 'Scheda non deve restare evidenziata');
  window.close();
});

test('Scheda: tornando su Scheda dopo essere stati su Storico, si vede di nuovo la scheda vera (non resta sullo Storico)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.querySelector('#navTabsGlobale button[data-go="storico"]').click();
    document.querySelector('#navTabsGlobale button[data-go="program"]').click();
  `);
  assert.equal(document.getElementById('programSchedaBlock').style.display, 'block');
  assert.equal(document.getElementById('programStoricoBlock').style.display, 'none');
  const btnStorico = document.querySelector('#navTabsGlobale button[data-go="storico"]');
  const btnScheda = document.querySelector('#navTabsGlobale button[data-go="program"]');
  assert.ok(btnScheda.classList.contains('active'));
  assert.ok(!btnStorico.classList.contains('active'));
  window.close();
});

test('Glossario e Account restano raggiungibili a programma (da Account), anche senza voce fissa in nav', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriAccountPanel();
    document.getElementById('acctVaiGlossario').click();
  `);
  assert.equal(document.getElementById('appRoot').style.display, 'block');
  assert.ok(document.getElementById('view-glossario').classList.contains('active'));
  window.close();
});
