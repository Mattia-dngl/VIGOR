'use strict';
// MODALITÀ PROPRIETARIO (11/09/2026) — sull'account che gestisce VIGOR
// convivevano tre mestieri: atleta, Personal Trainer e proprietario. Da qui
// in poi resta solo il terzo: Scheda/Registra/Dieta/Storico spariscono dalla
// navigazione e la Home diventa la console.
//
// Il test più importante è l'ultimo: l'area PT NON deve sparire finché ci
// sono clienti attivi collegati, altrimenti quelle persone restano senza
// nessuno che possa aprire la loro scheda.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');
const fs = require('node:fs');
const path = require('node:path');
const CSS_REALE = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

const AMMINISTRATORE = 'dangelomattia2002@gmail.com';

// Porta la finestra allo stato "sono entrato come X", come fa dopoAccessoOnline.
function entraCome(email, rapporti){
  return `
    utenteOnline = { id:'test-uid', email:'${email}' };
    rigaOnline = { id:'test-uid', email:'${email}', nome:'Io', approvato:true, is_pt:true, dati:loggedInProfile() };
    loggedInProfile().email = '${email}';
    _rapporti = ${JSON.stringify(rapporti || [])};
    sb = { from(){ return { select(){ return this; }, gte(){ return Promise.resolve({ count:0, error:null }); } }; } };
    aggiornaModalitaProprietario();
  `;
}

test('sull\'account proprietario la parte da atleta sparisce dalla navigazione', async () => {
  const { window, document } = await loadApp();
  await run(window, entraCome(AMMINISTRATORE));
  assert.ok(document.body.classList.contains('modalita-proprietario'));

  // Le voci restano nel documento (non vengono distrutte): a spegnerle è il
  // CSS. jsdom non carica i fogli di stile esterni, quindi la regola la
  // verifico sul file vero — è comunque il punto in cui si romperebbe se
  // qualcuno rinominasse un data-go.
  for(const id of ['program', 'diet', 'storico']){
    assert.ok(document.querySelector(`#navTabsGlobale .nav-go-btn[data-go="${id}"]`),
      `la voce ${id} deve restare nel documento`);
    assert.match(CSS_REALE, new RegExp(`body\\.modalita-proprietario [^,{]*\\[data-go="${id}"\\]`));
  }
  assert.match(CSS_REALE, /body\.modalita-proprietario #fabRegistraBtn/);
  assert.match(CSS_REALE, /body\.modalita-proprietario #sidebarRegistraBtn/);
  // #homePTBtn vive fuori da .home-columns: se non fosse spento a parte
  // resterebbe visibile in Home anche senza nessun cliente collegato
  assert.match(CSS_REALE, /body\.modalita-proprietario #homePTBtn/);
  window.close();
});

test('per chiunque altro non cambia niente', async () => {
  const { window, document } = await loadApp();
  await run(window, entraCome('niccolo111203@gmail.com'));
  assert.equal(document.body.classList.contains('modalita-proprietario'), false);
  assert.equal(document.getElementById('consoleHome').innerHTML.trim(), '');
  window.close();
});

test('la Home del proprietario mostra la console al posto del saluto', async () => {
  const { window, document } = await loadApp();
  await run(window, entraCome(AMMINISTRATORE) + 'mostraHome();');
  assert.equal(document.getElementById('homeSaluto').textContent, 'Console');
  const testo = document.getElementById('consoleHome').textContent;
  assert.match(testo, /Salute dell'app/);
  assert.match(testo, /Gestione dell'app/);
  window.close();
});

test('"Salute dell\'app" dalla console apre la finestra degli errori', async () => {
  const { window, document } = await loadApp();
  await run(window, entraCome(AMMINISTRATORE) + `
    mostraHome();
    document.getElementById('consoleVerSalute').click();
  `);
  assert.ok(document.getElementById('saluteOverlay').classList.contains('show'));
  window.close();
});

test('senza clienti collegati la voce dell\'area PT non compare', async () => {
  const { window, document } = await loadApp();
  await run(window, entraCome(AMMINISTRATORE, []) + 'mostraHome();');
  assert.equal(document.getElementById('consoleVersoPT'), null);
  window.close();
});

test('con clienti ancora collegati la voce compare e li conta', async () => {
  // È la protezione che conta: se questa voce sparisse mentre Fabrizio e Maty
  // sono ancora attaccati a questo account, resterebbero senza PT.
  const { window, document } = await loadApp();
  await run(window, entraCome(AMMINISTRATORE, [
    { id:'r1', pt_id:'test-uid', cliente_id:'fabrizio', stato:'attivo' },
    { id:'r2', pt_id:'test-uid', cliente_id:'maty', stato:'attivo' },
    { id:'r3', pt_id:'test-uid', cliente_id:'ex', stato:'terminato' },
    { id:'r4', pt_id:'altro-pt', cliente_id:'test-uid', stato:'attivo' }
  ]) + 'mostraHome();');
  const voce = document.getElementById('consoleVersoPT');
  assert.ok(voce, 'la voce deve esserci finché ci sono clienti attivi');
  assert.equal(voce.querySelector('.console-voce-num').textContent, '2',
    'due attivi: il terminato e il rapporto in cui sono io il cliente non contano');
  window.close();
});

test('il proprietario non atterra più nell\'area PT quando entra', async () => {
  const { window } = await loadApp();
  const r = await run(window, entraCome(AMMINISTRATORE) + `
    let apertaPT = false;
    apriAreaPT = () => { apertaPT = true; };
    if(sonoPT() && !modalitaProprietarioAttiva()) apriAreaPT();
    return apertaPT;
  `);
  assert.equal(r, false);
  window.close();
});

test('un PT normale continua ad atterrare nella sua area', async () => {
  const { window } = await loadApp();
  const r = await run(window, entraCome('niccolo111203@gmail.com') + `
    let apertaPT = false;
    apriAreaPT = () => { apertaPT = true; };
    if(sonoPT() && !modalitaProprietarioAttiva()) apriAreaPT();
    return apertaPT;
  `);
  assert.equal(r, true);
  window.close();
});

test('sull\'account console non vengono più segnati giorni "saltati"', async () => {
  // Un profilo che non si allena più si riempirebbe di assenze automatiche.
  const { window } = await loadApp();
  const r = await run(window, entraCome(AMMINISTRATORE) + `
    const prof = loggedInProfile();
    prof.programs = [{ id:'P1', name:'S', createdAt:'2026-01-01', archivedAt:null,
      days:[{ key:'A', name:'Petto', weekday:'Lunedì', exercises:[] }], diet:{}, dietInfo:{} }];
    prof.activeProgramId = 'P1';
    prof.logs = [];
    _autoSkipFatto = null;
    return autoRegistraSaltati();
  `);
  assert.equal(r, 0);
  window.close();
});
