'use strict';
// Modifiche del 25/08/2026 su richiesta dell'utente (con mockup Figma):
//  - Home ridiventa una voce della nav in basso (etichetta "Dashboard"), con
//    avatar (invece dell'ingranaggio) in alto a destra che apre Account.
//  - Il bottone centrale rialzato della nav non porta più a Home: ora è un
//    "+" che apre Registra da qualunque schermata.
//  - Account e Glossario non hanno più una voce fissa nella nav: si aprono
//    da Account (raggiunto dall'avatar).
//  - Storico diventa una voce a sé della nav, invece di un segmento dentro
//    Scheda: apriStorico() mostra lo stesso contenuto di sempre
//    (programStoricoBlock) ma la nav evidenzia "Storico", non "Scheda".
//
// Aggiornamento 25/08/2026 (diciassettesimo giro), su richiesta esplicita:
//  - Ordine della nav cambiato a Home, Scheda, + Registra, Dieta, Storico
//    (prima era Scheda, Dieta, + Registra, Dashboard, Storico) ed etichetta
//    da "Dashboard" a "Home" (preferenza esplicita dell'utente).
//  - Glossario non è più una vista/tab a sé: è diventato una tendina dentro
//    Account (id accGlossario), come Impostazioni/Privacy e
//    Sicurezza/Assistenza — non naviga più via, si apre in loco.
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
  assert.match(document.querySelector('#navTabsGlobale button[data-go="home"] .tab-label').textContent, /Home/);
  assert.ok(document.querySelector('#navTabsGlobale button[data-go="storico"]'), 'Storico deve avere una voce propria');
  assert.equal(document.querySelector('#navTabsGlobale button[data-go="account"]'), null);
  assert.equal(document.querySelector('#navTabsGlobale button[data-go="glossario"]'), null);
  window.close();
});

test('nav in basso: ordine Home, Scheda, + Registra, Dieta, Storico', async () => {
  const { window, document } = await loadApp();
  await run(window, `mostraHome();`);
  const bottoni = Array.from(document.querySelectorAll('#navTabsGlobale > button'));
  const chiavi = bottoni.map(b => b.id === 'fabRegistraBtn' ? 'registra' : b.dataset.go);
  assert.deepEqual(chiavi, ['home', 'program', 'registra', 'diet', 'storico']);
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

test('Glossario resta raggiungibile da Account, ma ora come tendina che si apre in loco (non naviga più via)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriAccountPanel();
  `);
  const acc = document.getElementById('accGlossario');
  assert.ok(acc, 'la tendina Glossario deve esistere dentro Account');
  assert.equal(acc.tagName, 'DETAILS');
  assert.equal(acc.open, false, 'chiusa di default');
  // Aprirla non deve portare via da Account: appRoot resta nascosto,
  // accountPanel resta quello visibile.
  await run(window, `document.getElementById('accGlossario').open = true;`);
  assert.notEqual(document.getElementById('appRoot').style.display, 'block');
  assert.equal(document.getElementById('accountPanel').style.display, 'block');
  window.close();
});
