'use strict';
// Test delle due modifiche più "di interazione" di questa consegna:
//  - l'onboarding al primo accesso chiede anche la data di nascita (non più
//    l'età a mano) insieme a sesso/peso/altezza/attività;
//  - l'editor scheda salva una scadenza opzionale, leggibile poi da segnaliPT.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloVuoto(){
  return {
    id: 'io', name: 'Io', email: 'io@test.it', createdAt:'2026-01-01', approvato:true, richiestoIl:'2026-01-01',
    passwordHash:'x', sesso:null, dataNascita:null, eta:null, altezza:null,
    livelloAttivita:'moderato', obiettivoCalorico:'mantenimento',
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId:'p1', logs:[], measurements:[], mealLogs:[], customExercises:{}, customFoods:{}, avatarUrl:null
  };
}

test('onboarding: "Continua" salva sesso e data di nascita sul profilo', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    state.profiles = [profilo];
    activeProfileId = 'io';

    document.querySelector('#onbSesso .seg-btn[data-val="uomo"]').click();
    document.getElementById('onbDataNascita').value = '1994-05-20';
    document.getElementById('onbContinua').click();

    const p = state.profiles.find(x=>x.id==='io');
    return { sesso: p.sesso, dataNascita: p.dataNascita };
  `);
  assert.equal(r.sesso, 'uomo');
  assert.equal(r.dataNascita, '1994-05-20');
  window.close();
});

test('onboarding: senza scegliere sesso non si passa oltre (data di nascita da sola non basta)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    state.profiles = [profilo];
    activeProfileId = 'io';
    document.getElementById('onbDataNascita').value = '1994-05-20';
    document.getElementById('onbContinua').click();
    const p = state.profiles.find(x=>x.id==='io');
    return { sesso: p.sesso, dataNascita: p.dataNascita };
  `);
  assert.equal(r.sesso, null);
  assert.equal(r.dataNascita, null); // il salvataggio della data avviene solo dopo la scelta del sesso
  window.close();
});

test('account: cambiare la data di nascita aggiorna subito l\'età mostrata (sola lettura)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    state.profiles = [profilo];
    activeProfileId = 'io';
    apriAccountPanel();
    const oggi = new Date();
    document.getElementById('setDataNascita').value = (oggi.getFullYear()-40) + '-01-01';
    document.getElementById('setDataNascita').dispatchEvent(new window.Event('change'));
    return {
      testo: document.getElementById('setEtaCalcolata').textContent,
      dataSalvata: state.profiles.find(x=>x.id==='io').dataNascita
    };
  `);
  assert.match(r.testo, /^(39|40) anni$/);
  assert.ok(r.dataSalvata.startsWith(String(new Date().getFullYear()-40)));
  window.close();
});

test('scheda: "Aggiorna scheda" salva la scadenza opzionale sul programma attivo', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    state.profiles = [profilo];
    activeProfileId = 'io';
    renderNewProgramForm();
    document.getElementById('newProgramScadenza').value = '2026-12-31';
    document.getElementById('updateProgramBtn').click();
    const p = state.profiles.find(x=>x.id==='io');
    return p.programs.find(x=>x.id==='p1').scadenza;
  `);
  assert.equal(r, '2026-12-31');
  window.close();
});

test('scheda: lasciare la scadenza vuota la azzera (nessun piano "scaduto per errore")', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloVuoto())};
    profilo.programs[0].scadenza = '2020-01-01'; // valore precedente da cancellare
    state.profiles = [profilo];
    activeProfileId = 'io';
    renderNewProgramForm();
    document.getElementById('newProgramScadenza').value = '';
    document.getElementById('updateProgramBtn').click();
    const p = state.profiles.find(x=>x.id==='io');
    return p.programs.find(x=>x.id==='p1').scadenza;
  `);
  assert.equal(r, null);
  window.close();
});
