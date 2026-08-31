'use strict';
// Sostituisce test/carosello-esercizi.test.js.
//
// Feedback dell'utente su screenshot (31/08/2026): "toglierei il carosello
// degli esercizi e li metterei uno sotto l'altro così da non avere bug di
// nessun tiipo sul carosello" — sia in Registra sia in Allenamento libero.
// Il vecchio carosello (un esercizio alla volta, position:absolute,
// mostraEsercizio/inizializzaCarosello/frecce/swipe) aveva una storia di 3
// bug via via più sottili (vedi il vecchio file, rimosso) legati proprio
// all'idea di mostrare un solo esercizio alla volta e calcolarne l'altezza:
// con tutti gli esercizi semplicemente impilati e sempre visibili
// quell'intera classe di bug non può più esistere per costruzione — qui si
// verifica che sia davvero così, non che l'animazione sia "giusta".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, run } = require('./helpers/loadApp.js');

function giornoConTreEsercizi(){
  return {
    key:'A', name:'Petto', weekday:'Lunedì',
    exercises: [
      { name:'Panca Piana', sets:5, reps:'5', muscles:['Petto'] },
      { name:'Chest Press', sets:4, reps:'20', muscles:['Petto'],
        dropset: { tipo:'dropset', drops: [{reps:'8', riduzione:25}, {reps:'8', riduzione:25}] } },
      { name:'Military Press', sets:4, reps:'8', muscles:['Spalle'] }
    ]
  };
}

function profiloBase(){
  return {
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{},
    programs: [{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId: 'p1', mealLogs: []
  };
}

test('buildExerciseForm: tutti gli esercizi finiscono nel DOM insieme, nessuno "attivo" o nascosto', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConTreEsercizi())});
    const list = document.getElementById('exerciseFormList');
    return {
      nBlocchi: list.children.length,
      nomi: Array.from(list.querySelectorAll('.exercise-name')).map(n => n.textContent),
      classiBlocchi: Array.from(list.children).map(b => b.className)
    };
  `);
  assert.equal(r.nBlocchi, 3, 'i tre esercizi devono essere tutti nel DOM contemporaneamente');
  assert.ok(r.nomi.some(n => n.includes('Panca Piana')));
  assert.ok(r.nomi.some(n => n.includes('Chest Press')));
  assert.ok(r.nomi.some(n => n.includes('Military Press')));
  // niente più concetto di "esercizio attivo": nessuna classe active/entra-*/esce-*
  r.classiBlocchi.forEach(c => {
    assert.ok(!/\bactive\b|entra-avanti|entra-indietro|esce-avanti|esce-indietro/.test(c),
      `il blocco non deve più portare classi di stato del carosello (trovato: "${c}")`);
  });
  window.close();
});

test('buildExerciseForm: le serie di OGNI esercizio sono già nel DOM, senza dover "navigare" per vederle (addSetRow resta invariato)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConTreEsercizi())});
  `);
  const righePanca = document.querySelectorAll('.sets-container[data-ex="Panca Piana"] .set-row');
  const righeMilitary = document.querySelectorAll('.sets-container[data-ex="Military Press"] .set-row');
  assert.equal(righePanca.length, 5, 'le 5 serie di Panca Piana devono esserci subito, senza bisogno di "scorrere" fino a quell\'esercizio');
  assert.equal(righeMilitary.length, 4, 'stesso discorso per Military Press, il terzo esercizio della lista');
  window.close();
});

test('superset "Vai →": scorre fino al blocco del partner invece di cambiare "esercizio attivo" in un carosello', async () => {
  const { window, document } = await loadApp();
  const giorno = {
    key:'A', name:'Petto+Dorso', weekday:'Lunedì',
    exercises: [
      { name:'Panca Piana', sets:3, reps:'8', muscles:['Petto'], supersetCon: 1 },
      { name:'Rematore', sets:3, reps:'8', muscles:['Dorso'] }
    ]
  };
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giorno)});
    // jsdom non implementa scrollIntoView: registro solo che sia stato chiamato
    Array.from(document.getElementById('exerciseFormList').children).forEach(b => {
      b.scrollIntoView = function(){ b.dataset.scrollato = '1'; };
    });
  `);
  const btn = document.querySelector('.superset-vai');
  assert.ok(btn, 'deve esserci il pulsante "Vai →" del superset');
  btn.click();
  const target = document.querySelector('.exercise-block[data-ex-index="1"]');
  assert.equal(target.dataset.scrollato, '1', 'deve scorrere fino al blocco del partner (Rematore), non "cambiare pagina" a un carosello');
  window.close();
});

test('Allenamento libero: ogni esercizio ha il proprio tasto di rimozione (sostituisce il vecchio #freeDelExBtn legato al carosello)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptAllenamento').click();
    selectDay('LIBERO');
    freeAddExercise({ n:'Squat', g:'Gambe' });
    freeAddExercise({ n:'Affondi', g:'Gambe' });
  `);
  let btns = document.querySelectorAll('.ex-remove-btn');
  assert.equal(btns.length, 2, 'ogni esercizio dell\'allenamento libero deve avere il proprio tasto di rimozione');
  assert.equal(document.getElementById('freeDelExBtn'), null, 'il vecchio tasto globale "Togli esercizio" non deve più esistere');

  // rimuovo il primo esercizio (Squat): serve conferma, come prima
  btns[0].click();
  const conferma = document.getElementById('customConfirmOk');
  assert.ok(conferma, 'deve chiedere conferma prima di togliere un esercizio, come in precedenza');
  conferma.click();

  const r = await run(window, `return { nomi: FREE_DAY.exercises.map(e => e.name) };`);
  assert.deepEqual(r.nomi, ['Affondi'], 'deve restare solo Affondi dopo aver tolto Squat');
  btns = document.querySelectorAll('.ex-remove-btn');
  assert.equal(btns.length, 1, 'deve restare un solo tasto di rimozione, per l\'unico esercizio rimasto');
  window.close();
});

test('Registra (scheda pianificata, non libero): nessun tasto di rimozione sugli esercizi (si modifica solo dalla Scheda)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    buildExerciseForm(${JSON.stringify(giornoConTreEsercizi())});
  `);
  assert.equal(document.querySelectorAll('.ex-remove-btn').length, 0,
    'gli esercizi di un giorno di scheda non hanno un tasto "togli" qui (si cambiano da Modifica scheda)');
  window.close();
});

// Verifica strutturale (non di comportamento, già coperto sopra): il
// riquadro esercizio non deve più essere position:absolute — è proprio
// questo il cambiamento voluto, quindi un blocco non può più sporgere o
// sovrapporsi a un altro "per sbaglio", non c'è più nulla da calcolare.
test('CSS: il riquadro esercizio NON è più position:absolute (lista verticale, non più carosello)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const regolaBlocco = css.match(/\.exercise-block\{[^}]*\}/);
  assert.ok(regolaBlocco, 'la regola .exercise-block non è stata trovata in css/style.css');
  assert.ok(!/position\s*:\s*absolute/.test(regolaBlocco[0]), 'il riquadro esercizio non deve più essere position:absolute');
});

test('CSS: le classi di stato del vecchio carosello (active/entra-*/esce-*) non esistono più', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.ok(!/\.exercise-block\.active/.test(css));
  assert.ok(!/entra-avanti|entra-indietro|esce-avanti|esce-indietro/.test(css));
  assert.ok(!/\.ex-carousel/.test(css), 'non deve restare traccia delle vecchie classi .ex-carousel-*');
});
