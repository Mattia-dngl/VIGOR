'use strict';
// Bug trovato in revisione (01/09/2026): il ripristino della password con il
// "codice di recupero" (profilo LOCALE, offline) resettava la password e
// chiamava direttamente enterProfile(), senza mai controllare prof.bloccato
// o prof.approvato — a differenza di trySubmitPassword(), che invece li
// controlla entrambi (vedi test/account-bloccato.test.js). Risultato: un
// account sospeso da un admin, o mai ancora approvato, poteva rientrare
// nell'app semplicemente cliccando "Password dimenticata?" e usando il
// proprio codice di recupero — bypassando del tutto il blocco.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function apriRecuperoConCodice(extraProfilo){
  return `
    const prof = Object.assign({ id:'p1', name:'Profilo', email:'p@test.it',
      passwordHash: simpleHash('vecchia1234'), logs:[], measurements:[],
      customExercises:{}, customFoods:{} }, ${JSON.stringify(extraProfilo)});
    prof.recuperoHash = simpleHash(normalizzaCodice('ABCD-1234'));
    state.profiles = [prof];
    pendingProfileId = 'p1';
    document.getElementById('recuperoCodice').value = 'ABCD-1234';
    document.getElementById('recuperoPw1').value = 'nuovaPassword1';
    document.getElementById('recuperoPw2').value = 'nuovaPassword1';
    document.getElementById('recuperoBtn').click();
  `;
}

test('codice di recupero: un profilo bloccato non entra nell\'app, vede la schermata dedicata (non bypassa il blocco)', async () => {
  const { window, document } = await loadApp();
  await run(window, apriRecuperoConCodice({ approvato:false, bloccato:true }));
  assert.equal(window.eval('activeProfileId'), null,
    'non deve essere entrato nell\'app: nessun profilo deve risultare attivo');
  assert.ok(document.getElementById('accountBloccatoOverlay').classList.contains('show'),
    'deve comparire la schermata dedicata al blocco, come per il login con password normale');
  // la password va comunque aggiornata: il codice era corretto, solo l'ingresso resta negato
  assert.equal(window.eval(`simpleHash('nuovaPassword1') === state.profiles[0].passwordHash`), true);
  window.close();
});

test('codice di recupero: un profilo mai approvato non entra nell\'app', async () => {
  const { window, document } = await loadApp();
  await run(window, apriRecuperoConCodice({ approvato:false, bloccato:false }));
  assert.equal(window.eval('activeProfileId'), null,
    'non deve essere entrato nell\'app: ancora in attesa di approvazione');
  assert.ok(!document.getElementById('accountBloccatoOverlay').classList.contains('show'));
  assert.equal(document.getElementById('gateSelectView').style.display, 'block',
    'deve tornare alla lista profili, non restare sul modulo di recupero');
  window.close();
});

test('codice di recupero: un profilo approvato e non bloccato entra regolarmente nell\'app', async () => {
  const { window, document } = await loadApp();
  await run(window, apriRecuperoConCodice({ approvato:true, bloccato:false }));
  assert.equal(window.eval('activeProfileId'), 'p1',
    'un profilo regolare deve poter rientrare con il codice di recupero, come prima');
  assert.equal(document.getElementById('profileGate').style.display, 'none');
  window.close();
});
