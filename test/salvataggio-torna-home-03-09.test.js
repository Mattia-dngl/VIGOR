'use strict';
// Bug segnalato dall'utente (03/09/2026, con screenshot): finito di
// registrare un allenamento e premuto "Registra" (saveLogBtn), l'app doveva
// riportare in Home ma restava una situazione bloccata — il popup "Prima di
// iniziare" ricompariva sopra la Home, e la Home stessa restava senza la
// barra di navigazione in basso.
//
// Due cause distinte, entrambe nello stesso handler di saveLogBtn:
//  1) mostraHome() non toglieva mai la classe body.registra-aperto (la mette
//     apriRegistra(), la toglie showAppRoot() per ogni altra schermata) —
//     quella classe nasconde #navTabsGlobale (vedi css/style.css), quindi la
//     Home restava senza nav finché non si passava da un'altra navigazione.
//  2) l'handler chiamava renderDayChoices() PRIMA di mostraHome(): se il
//     giorno di oggi è un giorno vero di scheda, renderDayChoices() sceglie
//     di nuovo quel giorno con selectDay(), che richiama buildExerciseForm()
//     e quindi mostraPopupAllenamentoATempo() — con Registra ancora "visibile"
//     in quel momento (mostraHome() non era ancora stata chiamata) la
//     guardia registraEVisibileOra() lasciava passare il popup, che restava
//     aperto sopra la Home appena mostrata.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloConGiornoLunedi(){
  return {
    id: 'io', name: 'Io', email: 'io@test.it', logs: [], measurements: [], customExercises: {}, customFoods: {},
    programs: [{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId: 'p1', mealLogs: []
  };
}

test('salvare un allenamento riporta in Home CON la nav in basso, senza il popup "Prima di iniziare" bloccato sopra', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloConGiornoLunedi())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptAllenamento').click();

    // 2026-02-02 è un lunedì, come il giorno "A" della scheda: renderDayChoices()
    // lo sceglie da solo (stesso comportamento di sempre) e apre il popup
    // "Prima di iniziare" la prima volta, come farebbe un utente vero.
    logDateInput.value = '2026-02-02';
    renderDayChoices();
    const popupSiAprivaAllInizio = document.getElementById('atempoOverlay').classList.contains('show');
    document.getElementById('atempoIniziaBtn').click();   // "Inizia allenamento" nel popup

    document.getElementById('saveLogBtn').click();

    return {
      popupSiAprivaAllInizio,
      registraApertoDopoSalvataggio: document.body.classList.contains('registra-aperto'),
      popupApertoDopoSalvataggio: document.getElementById('atempoOverlay').classList.contains('show'),
      homeVisibile: document.getElementById('homeScreen').style.display === 'block',
    };
  `);
  assert.equal(r.popupSiAprivaAllInizio, true, 'il popup deve comparire normalmente scegliendo il giorno la prima volta');
  assert.equal(r.registraApertoDopoSalvataggio, false, 'mostraHome() deve togliere la classe che nasconde la nav in basso');
  assert.equal(r.popupApertoDopoSalvataggio, false, 'il popup "Prima di iniziare" non deve riaprirsi sopra la Home dopo il salvataggio');
  assert.equal(r.homeVisibile, true, 'deve tornare davvero sulla Home');
  window.close();
});
