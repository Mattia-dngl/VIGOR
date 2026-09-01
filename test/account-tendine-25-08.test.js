'use strict';
// Redesign della sezione Account ispirato ai social (Instagram), pur restando
// nello stile della web app (31/08/2026, terzo giro), su richiesta esplicita:
//  - "Notifiche" è stata tolta del tutto da Account (era solo un
//    collegamento rapido al promemoria dentro Impostazioni, mai stata una
//    sezione a sé — non serviva).
//  - "Il tuo profilo" (dati generali + nome) non è più dentro una tendina a
//    scomparsa: è una sezione normale, sempre visibile, in cima ad Account.
//  - In alto a destra di Account c'è "Chiudi" e l'icona ⚙ Impostazioni.
//  - Impostazioni raccoglie ORA tutte le opzioni secondarie (Password e
//    sicurezza, Allenamento e dati/timer/esercizi, Assistenza, Gestione
//    dell'app) in una schermata a sé (#settingsPanel), raggiunta con
//    l'icona ⚙ — non più tendine dentro Account come nel giro precedente
//    (25/08): la schermata principale di Account resta con solo le funzioni
//    più importanti (profilo, codice di recupero, Glossario, Messaggi, Esci).
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

test('Account: "Notifiche" non esiste più', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriAccountPanel();
  `);
  assert.equal(document.getElementById('acctVaiNotifiche'), null, '"Notifiche" deve essere sparita del tutto da Account');
  window.close();
});

test('Account: "Il tuo profilo" è una sezione normale sempre visibile, non una tendina', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriAccountPanel();
  `);
  const nomeInput = document.getElementById('accountNameInput');
  assert.ok(nomeInput, 'il campo nome deve esistere');
  assert.equal(nomeInput.closest('details'), null, 'non deve stare dentro nessuna tendina');
  const dataNascita = document.getElementById('setDataNascita');
  assert.equal(dataNascita.closest('details'), null, 'anche i dati generali non devono stare dentro una tendina');
  // sempre visibile: nessun elemento genitore con display:none dentro Account
  assert.ok(nomeInput.closest('#accountPanel'), 'deve stare dentro Account');
  window.close();
});

test('Account: in alto a destra ci sono "Chiudi" e l\'icona ⚙ Impostazioni', async () => {
  const { window, document } = await loadApp();
  const chiudi = document.getElementById('closeAccountBtn');
  const gear = document.getElementById('openSettingsBtn');
  assert.ok(chiudi, 'il bottone Chiudi deve esistere');
  assert.ok(gear, 'il bottone ⚙ Impostazioni deve esistere');
  assert.ok(gear.closest('.settings-head'), 'l\'ingranaggio deve stare nell\'intestazione di Account');
  window.close();
});

test('Impostazioni/Privacy/Assistenza sono <details> dentro #settingsPanel, chiuse di default', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriImpostazioni('account');
  `);
  ['accPrivacy','accAssistenza'].forEach(id=>{
    const el = document.getElementById(id);
    assert.ok(el, `#${id} deve esistere`);
    assert.equal(el.tagName, 'DETAILS', `#${id} deve essere una tendina`);
    assert.equal(el.open, false, `#${id} deve essere chiusa di default`);
    assert.ok(el.closest('#settingsPanel'), `#${id} deve stare dentro #settingsPanel`);
  });
  // accImpostazioni viene aperta automaticamente da apriImpostazioni().
  const acc = document.getElementById('accImpostazioni');
  assert.ok(acc.closest('#settingsPanel'));
  // Le vecchie schermate a sé indipendenti non esistono.
  ['privacySicurezzaPanel','assistenzaPanel'].forEach(id=>{
    assert.equal(document.getElementById(id), null, `#${id} non deve esistere come schermata a sé`);
  });
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('l\'icona ⚙ apre Impostazioni come schermata a sé (non più dentro Account)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriAccountPanel();
    document.getElementById('openSettingsBtn').click();
  `);
  assert.equal(document.getElementById('settingsPanel').style.display, 'block', 'Impostazioni deve aprirsi');
  assert.equal(document.getElementById('accountPanel').style.display, 'none', 'Account deve nascondersi dietro Impostazioni');
  assert.ok(document.getElementById('timerDurataInput'), 'il contenuto di Impostazioni è presente');
  assert.ok(document.getElementById('promemoriaCard'));
  await run(window, `document.getElementById('closeSettingsBtn').click();`);
  assert.equal(document.getElementById('settingsPanel').style.display, 'none', 'chiudendo, Impostazioni si richiude');
  assert.equal(document.getElementById('accountPanel').style.display, 'block', 'e si torna ad Account (da cui si era aperta con l\'ingranaggio)');
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('apriImpostazioni("app") (ingranaggio ⚙ dentro Scheda/Registra/Dieta) apre Impostazioni, e chiudendo si torna alla schermata di partenza', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    apriImpostazioni('app');
  `);
  assert.equal(document.getElementById('settingsPanel').style.display, 'block', 'apre Impostazioni');
  assert.equal(document.getElementById('accImpostazioni').open, true, 'la tendina Allenamento e dati si apre da sola');
  await run(window, `document.getElementById('closeSettingsBtn').click();`);
  assert.equal(document.getElementById('appRoot').style.display, 'block', 'chiudendo torna alla schermata di prima (Scheda), non a Home o Account');
  assert.equal(document.getElementById('settingsPanel').style.display, 'none');
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('apriImpostazioni("home") (es. da una notifica) apre Impostazioni, e chiudendo si torna in Home', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriImpostazioni('home');
  `);
  assert.equal(document.getElementById('settingsPanel').style.display, 'block');
  await run(window, `document.getElementById('closeSettingsBtn').click();`);
  assert.equal(document.getElementById('homeScreen').style.display, 'block', 'chiudendo torna in Home');
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('aprire la tendina "Password e sicurezza" aggiorna l\'email mostrata e sceglie il blocco online/offline giusto', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    utenteOnline = { id:'io', email:'io@test.it' };
    mostraHome();
    apriImpostazioni('account');
    document.getElementById('accPrivacy').open = true;
    document.getElementById('accPrivacy').dispatchEvent(new window.Event('toggle'));
    return {
      email: document.getElementById('privacyEmailMostrata').textContent,
      online: document.getElementById('pwOnlineBlock').style.display,
      offline: document.getElementById('pwOfflineBlock').style.display,
      settingsVisibile: document.getElementById('settingsPanel').style.display
    };
  `);
  assert.equal(r.email, 'io@test.it');
  assert.notEqual(r.online, 'none', 'online: il blocco email-per-cambiarla deve essere visibile');
  assert.equal(r.offline, 'none', 'online: il blocco password locale deve restare nascosto');
  assert.equal(r.settingsVisibile, 'block');
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('offline (nessun account online), "Password e sicurezza" mostra il cambio password locale', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    utenteOnline = null;
    mostraHome();
    apriImpostazioni('account');
    document.getElementById('accPrivacy').open = true;
    document.getElementById('accPrivacy').dispatchEvent(new window.Event('toggle'));
    return {
      online: document.getElementById('pwOnlineBlock').style.display,
      offline: document.getElementById('pwOfflineBlock').style.display
    };
  `);
  assert.equal(r.online, 'none', 'offline: il blocco email-per-cambiarla deve restare nascosto');
  assert.notEqual(r.offline, 'none', 'offline: il cambio password locale deve essere visibile');
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('Glossario resta raggiungibile direttamente da Account (non è finito dentro Impostazioni)', async () => {
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
  assert.ok(acc.closest('#accountPanel'), 'deve stare dentro #accountPanel, non #settingsPanel');
  window.close();
});

test('"Messaggi" si apre dall\'icona accanto all\'ingranaggio nell\'header di Account (01/09/2026: la vecchia riga a sé è stata tolta)', async () => {
  const { window, document } = await loadApp();
  const btn = document.getElementById('acctVaiMessaggiBtn');
  assert.ok(btn, 'deve esistere il bottone icona Messaggi nell\'header');
  assert.equal(btn.tagName, 'BUTTON');
  assert.ok(btn.closest('.settings-head-actions'), 'deve stare accanto a #openSettingsBtn');
  assert.equal(document.getElementById('acctVaiMessaggi'), null, 'la vecchia riga a sé non deve più esistere');
  window.close();
});
