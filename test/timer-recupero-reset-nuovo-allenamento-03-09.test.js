'use strict';
// Segnalazione utente (03/09/2026): "ogni volta che clicco un nuovo
// allenamento il cronometro è sempre attivo ma ha già 1 min". Causa reale:
// il timer di RECUPERO (_timerFine, onboarding.js) resta apposta a livello
// globale e continua a contare cambiando schermata, per poter riprendere da
// solo se ci si sposta DENTRO lo stesso allenamento (vedi commento su
// _timerFine in onboarding.js) — ma selectDay() non lo fermava mai, quindi
// un recupero lasciato in corso (es. l'ultima serie di un allenamento
// precedente, il cui timer non era mai stato atteso fino alla fine né
// fermato a mano) restava a contare e ricompariva identico scegliendo
// l'allenamento successivo, con la barra già a metà invece che pronta da
// zero.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloConDati(extra){
  return Object.assign({
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[],
    customExercises:{}, customFoods:{}, mealLogs:[], waterLogs:[],
    sesso:'uomo', dataNascita:'1995-06-15', altezza:180, livelloAttivita:'moderato', obiettivoCalorico:'mantenimento',
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[
        {key:'A', name:'Giorno A', weekday:'Mercoledì', exercises:[{name:'Panca piana', sets:3, reps:'8-10', recupero:90}]},
        {key:'B', name:'Giorno B', weekday:'Giovedì', exercises:[{name:'Squat', sets:3, reps:'8-10', recupero:90}]}
      ], dietInfo:{}, diet:{} }],
    activeProgramId:'p1'
  }, extra||{});
}

test('scegliere un nuovo allenamento ferma un timer di recupero lasciato in corso dal precedente', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriRegistra();
    selectDay('A');
    timerAvvia(90);
  `);
  // simulo un recupero già a metà (60s passati su 90s) lasciato indietro
  await run(window, `_timerFine = Date.now() + 30000;`);

  // l'utente sceglie un NUOVO allenamento
  await run(window, `selectDay('B');`);

  const r = await run(window, `return {
    timerFermo: _timerFine === null,
    testoAvvia: document.getElementById('timerAvvia').textContent
  };`);
  assert.equal(r.timerFermo, true, 'il timer di recupero del vecchio allenamento non deve restare a contare in quello nuovo');
  assert.equal(r.testoAvvia, 'Avvia', 'il bottone deve tornare a "Avvia", non restare su "Ferma"');
  window.close();
});

test('un timer di recupero avviato DENTRO lo stesso allenamento continua a contare normalmente (nessuna regressione)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloConDati())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    apriRegistra();
    selectDay('A');
    timerAvvia(90);
  `);
  const r = await run(window, `return { inCorso: _timerFine !== null };`);
  assert.equal(r.inCorso, true, 'un timer avviato ora, senza cambiare allenamento, deve restare attivo');
  window.close();
});
