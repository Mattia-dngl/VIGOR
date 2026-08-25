'use strict';
// Richiesta esplicita dell'utente (25/08/2026, diciassettesimo giro): le
// righe di Account che prima navigavano via a una schermata a sé
// (Impostazioni, Glossario, Privacy e Sicurezza, Assistenza) sono ora
// tendine come "Dati generali"/"Nome e password" — si aprono in loco,
// niente più cambio di schermata. Eccezione dichiarata: "Messaggi" resta
// una schermata a sé (è una chat vera, può avere più conversazioni: non si
// presta a una tendina statica).
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

test('Impostazioni/Glossario/Privacy/Assistenza sono <details> dentro Account, chiuse di default', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriAccountPanel();
  `);
  ['accImpostazioni','accGlossario','accPrivacy','accAssistenza'].forEach(id=>{
    const el = document.getElementById(id);
    assert.ok(el, `#${id} deve esistere`);
    assert.equal(el.tagName, 'DETAILS', `#${id} deve essere una tendina`);
    assert.equal(el.open, false, `#${id} deve essere chiusa di default`);
  });
  // Le vecchie schermate a sé (panel indipendenti) non esistono più.
  ['settingsPanel','privacySicurezzaPanel','assistenzaPanel'].forEach(id=>{
    assert.equal(document.getElementById(id), null, `#${id} non deve più esistere come schermata a sé`);
  });
  // #view-glossario esiste ancora (stesso id, serve alle query interne del
  // glossario), ma ora è un div qualunque dentro la tendina, non più una
  // <section class="view"> raggiungibile a sé tramite la nav storica.
  const gloss = document.getElementById('view-glossario');
  assert.ok(gloss, '#view-glossario deve ancora esistere (contenitore interno)');
  assert.notEqual(gloss.tagName, 'SECTION');
  assert.equal(gloss.classList.contains('view'), false);
  window.close();
});

test('aprire la tendina Impostazioni non naviga via: Account resta la schermata visibile', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriAccountPanel();
    document.getElementById('accImpostazioni').open = true;
    document.getElementById('accImpostazioni').dispatchEvent(new window.Event('toggle'));
  `);
  assert.equal(document.getElementById('accountPanel').style.display, 'block');
  assert.notEqual(document.getElementById('appRoot').style.display, 'block');
  // Il contenuto della tendina (spostato dalla vecchia Impostazioni) è presente.
  assert.ok(document.getElementById('timerDurataInput'));
  assert.ok(document.getElementById('promemoriaCard'));
  // aggiornaStatoDati() (dentro renderImpostazioniInline) è asincrona
  // (navigator.storage): lascio un attimo perché si risolva prima di
  // chiudere la finestra, altrimenti la promise pendente prova a toccare
  // un document ormai smontato.
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('apriImpostazioni("app") (ingranaggio ⚙ dentro Scheda/Registra/Dieta) apre Account+tendina, e chiudendo si torna alla schermata di partenza', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    apriImpostazioni('app');
  `);
  assert.equal(document.getElementById('accountPanel').style.display, 'block', 'apre Account');
  assert.equal(document.getElementById('accImpostazioni').open, true, 'la tendina Impostazioni si apre da sola');
  await run(window, `document.getElementById('closeAccountBtn').click();`);
  assert.equal(document.getElementById('appRoot').style.display, 'block', 'chiudendo torna alla schermata di prima (Scheda), non a Home');
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('apriImpostazioni("home") (es. da una notifica) apre Account+tendina, e chiudendo si torna in Home', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriImpostazioni('home');
  `);
  assert.equal(document.getElementById('accountPanel').style.display, 'block');
  await run(window, `document.getElementById('closeAccountBtn').click();`);
  assert.equal(document.getElementById('homeScreen').style.display, 'block', 'chiudendo torna in Home');
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('"Notifiche" in Account apre la tendina Impostazioni e apre/scrolla la card promemoria nidificata', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    // jsdom non ha Notification/serviceWorker: forzo "supportato" così
    // renderPromemoria() non nasconda la card prima che il test possa
    // verificarne l'apertura (stessa card, comportamento reale su un
    // telefono vero con le notifiche supportate).
    window.promemoriaSupportato = () => true;
    navigator.serviceWorker = { ready: Promise.resolve({ pushManager: { getSubscription: async () => null } }) };
    window.Notification = window.Notification || { permission: 'default', requestPermission: async () => 'default' };
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriAccountPanel();
    document.getElementById('acctVaiNotifiche').click();
  `);
  assert.equal(document.getElementById('accImpostazioni').open, true);
  assert.equal(document.getElementById('promemoriaCard').open, true);
  await new Promise(r => setTimeout(r, 30));
  window.close();
});

test('aprire la tendina Privacy e Sicurezza aggiorna l\'email mostrata senza navigare via', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    utenteOnline = { id:'io', email:'io@test.it' };
    mostraHome();
    apriAccountPanel();
    document.getElementById('accPrivacy').open = true;
    document.getElementById('accPrivacy').dispatchEvent(new window.Event('toggle'));
  `);
  assert.equal(document.getElementById('privacyEmailMostrata').textContent, 'io@test.it');
  assert.equal(document.getElementById('accountPanel').style.display, 'block');
  window.close();
});

test('"Messaggi" resta un bottone che apre una schermata a sé (eccezione dichiarata: è una chat vera)', async () => {
  const { window, document } = await loadApp();
  const btn = document.getElementById('acctVaiMessaggi');
  assert.ok(btn);
  assert.equal(btn.tagName, 'BUTTON');
  window.close();
});
