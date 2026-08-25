'use strict';
// Test del carosello esercizi in Registra (index.html: mostraEsercizio /
// inizializzaCarosello / osservaAltezzaEsercizioAttivo).
//
// Storia dei bug qui dentro (utile per chi riprende in mano il file):
//  1) la tabella della serie non si adattava all'esercizio che si sta
//     guardando, ma restava alta quanto l'esercizio più lungo del giorno
//  2) il fix del punto 1 "scattava" solo a scorrimento finito: durante lo
//     swipe il contenuto sporgeva e si sovrapponeva ai pulsanti sotto
//  3) il fix del punto 2 (interpolare l'altezza in base allo scorrimento)
//     lasciava comunque, per un istante, un filo di contenuto del blocco
//     precedente visibile sopra a quello nuovo durante lo swipe — un
//     "fantasma" dell'esercizio di prima (es. su Military Press)
// Il punto 3 non è stato risolto con un'altra rincorsa alla precisione del
// calcolo, ma cambiando architettura: non più un nastro con TUTTI gli
// esercizi affiancati e un'altezza indovinata a metà scorrimento, ma un
// riquadro indipendente per esercizio (sempre nel DOM, position:absolute,
// invisibile finché non è quello attivo) e un cambio esercizio "deciso"
// (mostraEsercizio legge l'altezza vera del blocco di arrivo una volta sola
// e lascia animare la transizione CSS, senza mai indovinare un valore a
// metà fra due blocchi diversi).
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
        dropset: { tipo:'dropset', drops: [{reps:'8', riduzione:25}, {reps:'8', riduzione:25}] } },
      { name:'Military Press', sets:4, reps:'8', muscles:['Spalle'] }
    ]
  };
}

function preparaEDefinisciAltezze(){
  // jsdom non calcola un vero layout: definisco scrollHeight a mano per
  // simulare "l'esercizio corto è basso, quello con il dropset è molto più
  // alto", esattamente come sarebbe nella realtà con contenuti diversi.
  return `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConDueEsercizi())});
    const list = document.getElementById('exerciseFormList');
    Object.defineProperty(list.children[0], 'scrollHeight', { value: 300, configurable:true });
    Object.defineProperty(list.children[1], 'scrollHeight', { value: 900, configurable:true });
    Object.defineProperty(list.children[2], 'scrollHeight', { value: 500, configurable:true });
  `;
}

test('inizializzaCarosello: solo il primo blocco è attivo, l\'altezza è la SUA, non quella del più alto del giorno', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${preparaEDefinisciAltezze()}
    // le altezze finte sono definite SOPO che buildExerciseForm ha già
    // inizializzato il carosello (con scrollHeight reale = 0 in jsdom): la
    // richiamo di nuovo, ora che i valori finti sono al loro posto, per
    // testare davvero cosa fa inizializzaCarosello con contenuti di
    // lunghezza diversa.
    inizializzaCarosello();
    return {
      altezza: list.style.height,
      classiBlocchi: Array.from(list.children).map(b => b.className),
      contatore: document.getElementById('exCarouselCounter').textContent
    };
  `);
  // 300px (Panca Piana, il blocco attivo) e non 900px (Chest Press, il più
  // alto del giorno ma non quello che si sta guardando)
  assert.equal(r.altezza, '300px');
  assert.match(r.classiBlocchi[0], /\bactive\b/);
  assert.ok(!/\bactive\b/.test(r.classiBlocchi[1]));
  assert.ok(!/\bactive\b/.test(r.classiBlocchi[2]));
  assert.equal(r.contatore, '1 / 3');
  window.close();
});

test('mostraEsercizio: l\'altezza diventa ESATTAMENTE quella del blocco di arrivo, mai una via di mezzo con quella lasciata', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${preparaEDefinisciAltezze()}

    mostraEsercizio(1);   // da Panca Piana (300) a Chest Press (900)
    const altezzaSuLungo = list.style.height;
    const classiDopoAvanti = Array.from(list.children).map(b => b.className);

    mostraEsercizio(2);   // da Chest Press (900) a Military Press (500)
    const altezzaSuMilitary = list.style.height;

    mostraEsercizio(0);   // e torno a Panca Piana (300)
    const altezzaTornandoSuCorto = list.style.height;

    return { altezzaSuLungo, altezzaSuMilitary, altezzaTornandoSuCorto, classiDopoAvanti };
  `);
  assert.equal(r.altezzaSuLungo, '900px');
  // fondamentale: passando da 900 a 500 l'altezza è ESATTAMENTE 500, non una
  // media/interpolazione con il valore precedente (era proprio questo il
  // meccanismo — l'interpolazione in base allo scorrimento — che poteva
  // lasciare un filo del blocco precedente visibile sopra a quello nuovo)
  assert.equal(r.altezzaSuMilitary, '500px');
  assert.equal(r.altezzaTornandoSuCorto, '300px');
  // il blocco che entra ha subito la classe "active" (diventa quello
  // visibile), quello che esce non ce l'ha più — mai due blocchi
  // "settati" come attivi insieme
  assert.match(r.classiDopoAvanti[1], /\bactive\b/);
  assert.ok(!/\bactive\b/.test(r.classiDopoAvanti[0]));
  window.close();
});

test('mostraEsercizio: dopo la transizione resta attivo un solo blocco (il precedente si ripulisce a transizione finita)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${preparaEDefinisciAltezze()}
    mostraEsercizio(1);
    // subito dopo la chiamata, il blocco che esce può ancora avere le classi
    // di transizione (esce-avanti/esce-indietro): è normale, sono quelle che
    // la transizione CSS anima. jsdom non esegue transizioni reali, quindi
    // simulo la loro fine come farebbe il browser (transitionend).
    list.children[0].dispatchEvent(new window.Event('transitionend'));
    return Array.from(list.children).map(b => b.className);
  `);
  assert.match(r[1], /\bactive\b/);
  assert.ok(!/\bactive\b/.test(r[0]));
  assert.ok(!/esce-avanti|esce-indietro/.test(r[0]), 'a transizione finita non devono restare classi di uscita sul blocco vecchio');
  window.close();
});

test('mostraEsercizio: con {animato:false} salta la transizione (usato per ripristinare la posizione dopo un rebuild)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${preparaEDefinisciAltezze()}
    mostraEsercizio(2, {animato:false});
    return { altezza: list.style.height, classi: Array.from(list.children).map(b => b.className) };
  `);
  assert.equal(r.altezza, '500px');
  assert.match(r.classi[2], /\bactive\b/);
  assert.ok(!/entra-avanti|entra-indietro|esce-avanti|esce-indietro/.test(r.classi[2]), 'senza animazione non devono comparire classi di transizione');
  window.close();
});

test('frecce Precedente/Successivo: si disabilitano ai due estremi e usano mostraEsercizio', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    ${preparaEDefinisciAltezze()}
    const prev = document.getElementById('exPrevBtn');
    const next = document.getElementById('exNextBtn');
    const primaFila = { prevDisabilitato: prev.disabled, nextDisabilitato: next.disabled };
    next.click();
    next.click();   // ora sull'ultimo esercizio (indice 2 di 3)
    const ultimaFila = { prevDisabilitato: prev.disabled, nextDisabilitato: next.disabled, indice: currentExerciseIndex() };
    prev.click();
    prev.click();   // torno al primo
    const primaRitorno = { prevDisabilitato: prev.disabled, indice: currentExerciseIndex() };
    return { primaFila, ultimaFila, primaRitorno };
  `);
  assert.equal(r.primaFila.prevDisabilitato, true);
  assert.equal(r.primaFila.nextDisabilitato, false);
  assert.equal(r.ultimaFila.nextDisabilitato, true);
  assert.equal(r.ultimaFila.indice, 2);
  assert.equal(r.primaRitorno.prevDisabilitato, true);
  assert.equal(r.primaRitorno.indice, 0);
  window.close();
});

test('osservaAltezzaEsercizioAttivo: non va in crash se ResizeObserver non esiste (jsdom, alcuni browser vecchi)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    try{
      buildExerciseForm(${JSON.stringify(giornoConDueEsercizi())});
      mostraEsercizio(1);
      return { ok: true, resizeObserverDisponibile: typeof ResizeObserver !== 'undefined' };
    }catch(e){ return { ok:false, errore: e.message }; }
  `);
  assert.equal(r.ok, true, r.errore);
  window.close();
});

// Verifica strutturale (non di comportamento, che i test sopra già coprono):
// ogni `.exercise-block` è position:absolute per costruzione — è questo,
// non un taglio di overflow, a garantire che un blocco non attivo non possa
// mai contribuire all'altezza del contenitore né sovrapporsi a quello
// attivo. Qui si verifica solo che la regola non sparisca in un refactor.
test('CSS: ogni riquadro esercizio è position:absolute (nessun blocco non attivo può contribuire al layout)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  // .exercise-block compare più volte nel foglio di stile (c'è anche una
  // piccola regola responsive per il solo padding): cerco quella "principale"
  // del carosello, l'unica che porta anche position:absolute.
  const regolaBlocco = css.match(/\.exercise-block\{[^}]*position:absolute[^}]*\}/);
  assert.ok(regolaBlocco, 'la regola principale di .exercise-block (con position:absolute) non è stata trovata in css/style.css');
});
