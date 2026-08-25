'use strict';
// Test del carosello esercizi in Registra (index.html: updateExerciseCarouselUI /
// osservaAltezzaEsercizioCorrente). Bug segnalato con screenshot: la tabella
// della serie non si adattava all'esercizio che si sta guardando, ma restava
// alta quanto l'esercizio più lungo del giorno (un dropset con tante tappe),
// lasciando un vuoto enorme sotto gli esercizi semplici. Il contenitore
// `#exerciseFormList` è una riga flex con tutti gli esercizi affiancati: senza
// un'altezza esplicita, un flex container si alza quanto il figlio più alto.
// La correzione fissa l'altezza del contenitore su quella del SOLO blocco
// attivo, ricalcolata ad ogni cambio di esercizio.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, run } = require('./helpers/loadApp.js');

function giornoConDueEsercizi(){
  return {
    key:'A', name:'Petto', weekday:'Lunedì',
    exercises: [
      { name:'Panca Piana', sets:5, reps:'5', muscles:['Petto'] },          // esercizio "corto"
      { name:'Chest Press', sets:4, reps:'20', muscles:['Petto'],           // esercizio "lungo" (dropset)
        dropset: { tipo:'dropset', drops: [{reps:'8', riduzione:25}, {reps:'8', riduzione:25}] } }
    ]
  };
}

test('updateExerciseCarouselUI: l\'altezza del carosello segue solo il blocco attivo, non il più alto di tutti', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConDueEsercizi())});

    const list = document.getElementById('exerciseFormList');
    // jsdom non calcola un vero layout: simulo "l'esercizio corto è basso,
    // quello con il dropset è molto più alto" definendo scrollHeight a mano,
    // esattamente come sarebbe nella realtà con contenuti di lunghezza diversa.
    Object.defineProperty(list.children[0], 'scrollHeight', { value: 300, configurable:true });
    Object.defineProperty(list.children[1], 'scrollHeight', { value: 900, configurable:true });

    updateExerciseCarouselUI(0);
    const altezzaSuCorto = list.style.height;
    updateExerciseCarouselUI(1);
    const altezzaSuLungo = list.style.height;
    updateExerciseCarouselUI(0);
    const altezzaTornandoSuCorto = list.style.height;

    return { altezzaSuCorto, altezzaSuLungo, altezzaTornandoSuCorto };
  `);
  assert.equal(r.altezzaSuCorto, '300px');
  assert.equal(r.altezzaSuLungo, '900px');
  // fondamentale: tornando sull'esercizio corto il contenitore deve tornare
  // basso, non restare alto quanto quello con il dropset visto poco prima.
  assert.equal(r.altezzaTornandoSuCorto, '300px');
  window.close();
});

test('osservaAltezzaEsercizioCorrente: non va in crash se ResizeObserver non esiste (jsdom, alcuni browser vecchi)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    try{
      buildExerciseForm(${JSON.stringify(giornoConDueEsercizi())});
      return { ok: true, resizeObserverDisponibile: typeof ResizeObserver !== 'undefined' };
    }catch(e){ return { ok:false, errore: e.message }; }
  `);
  assert.equal(r.ok, true, r.errore);
  window.close();
});

// Bug segnalato (con screenshot) subito dopo il fix sopra: l'altezza cambiava
// SOLO a scorrimento finito (dopo il debounce), quindi durante lo swipe da un
// esercizio corto a uno lungo il contenuto del nuovo esercizio sporgeva e si
// sovrapponeva ai pulsanti Precedente/Successivo, per poi "scattare" di colpo
// alla fine. sincronizzaAltezzaCaroselloDuranteScorrimento deve tenere
// l'altezza interpolata in tempo reale, in base a quanto ci si è già spostati
// (scrollLeft), non solo all'indice dell'esercizio più vicino.
test('sincronizzaAltezzaCaroselloDuranteScorrimento: interpola l\'altezza in base allo scorrimento, non scatta di colpo a fine swipe', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConDueEsercizi())});

    const list = document.getElementById('exerciseFormList');
    Object.defineProperty(list.children[0], 'scrollHeight', { value: 300, configurable:true });
    Object.defineProperty(list.children[1], 'scrollHeight', { value: 900, configurable:true });
    Object.defineProperty(list, 'clientWidth', { value: 400, configurable:true });

    list.scrollLeft = 0;                       // fermo sul primo esercizio
    sincronizzaAltezzaCaroselloDuranteScorrimento();
    const inizio = list.style.height;

    list.scrollLeft = 200;                     // a metà dello swipe verso il secondo (più alto)
    sincronizzaAltezzaCaroselloDuranteScorrimento();
    const metaSwipe = list.style.height;

    list.scrollLeft = 400;                     // arrivato sul secondo esercizio
    sincronizzaAltezzaCaroselloDuranteScorrimento();
    const fineSwipe = list.style.height;

    return { inizio, metaSwipe, fineSwipe };
  `);
  assert.equal(r.inizio, '300px');
  // a metà strada l'altezza deve già essere a metà fra le due, non ferma a 300px
  // (altrimenti il contenuto del secondo esercizio, più alto, sporgerebbe e si
  // sovrapporrebbe ai pulsanti sotto durante lo swipe) né già scattata a 900px.
  assert.equal(r.metaSwipe, '600px');
  assert.equal(r.fineSwipe, '900px');
  window.close();
});

// Bug segnalato con screenshot (dopo il fix sopra): anche interpolando
// l'altezza in tempo reale, per un istante quel valore può restare un filo
// più basso del vero contenuto del blocco che si sta per raggiungere (jsdom
// non può simularlo: non fa vero layout). In quel caso, senza un blocco
// esplicito sull'asse verticale, il contenuto in eccedenza restava visibile
// FUORI dal riquadro e si vedeva come un "fantasma" dell'esercizio
// precedente sovrapposto a quello nuovo (es. su Military Press). La
// correzione è in CSS, non in altro JS di sincronizzazione: overflow-y:hidden
// sul contenitore rende quel caso limite innocuo (al massimo un filo di
// contenuto tagliato per una frazione di secondo) invece che un difetto
// visibile. Qui si verifica solo che la regola non sparisca in un refactor.
test('CSS: il carosello esercizi taglia l\'overflow verticale, cosicché nessun blocco possa "sporgere" sopra a quello vicino durante lo swipe', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const regolaTrack = css.match(/\.ex-carousel-track\s*\{[^}]*\}/);
  assert.ok(regolaTrack, '.ex-carousel-track non trovata in css/style.css');
  assert.match(regolaTrack[0], /overflow-y\s*:\s*hidden/, 'il contenitore del carosello deve tagliare l\'overflow verticale');
});
