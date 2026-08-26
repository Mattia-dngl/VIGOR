'use strict';
// Scheda ridisegnata in stile compatto, da due mockup (25/08/2026, diciottesimo
// giro): intestazione con matita ("Modifica scheda") + pulsante "+ Nuova
// scheda" al posto della vecchia barra Vedi/Modifica; card con i dati veri
// del programma (durata, data inizio, progresso settimane, PT — mai un
// numero inventato: compaiono solo se qualcuno li ha davvero impostati);
// giorni come <details> in sola lettura (oggi aperto, gli altri riassunti).
// Nell'editor, "un giorno alla volta": ogni giorno è una <details> esclusiva
// (aprirne una chiude le altre), stesso editor di sempre dentro.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function isoOggiMeno(giorni){
  const d = new Date();
  d.setDate(d.getDate() - giorni);
  return d.toISOString().slice(0,10);
}

function profiloBase(overrides){
  return Object.assign({
    id: 'io', name: 'Io', email: 'io@test.it', createdAt:'2026-01-01', logs: [], measurements: [],
    customExercises: {}, customFoods: {}, mealLogs: [],
    programs: [{
      id:'p1', name:'Programma Forza - Fase 2', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      durataSettimane:null, dataInizio:null, notePT:null,
      days:[
        { key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null, exercises:[
          { name:'Panca Piana', sets:3, reps:'10', recupero:null, muscles:[] }
        ] },
        { key:'B', name:'Giorno B', weekday:'Mercoledì', categoria:'cardio', exercises:[] }
      ],
      dietInfo:{}, diet:{}
    }],
    activeProgramId: 'p1'
  }, overrides || {});
}

test('renderSchedaView(): la card mostra nome del programma e badge ATTIVO', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    renderSchedaView();
  `);
  const card = document.querySelector('#programView .scheda-info-card');
  assert.ok(card, 'la card info programma deve esistere');
  assert.match(card.querySelector('.scheda-info-nome').textContent, /Programma Forza - Fase 2/);
  assert.match(card.querySelector('.scheda-badge-attivo').textContent, /ATTIVO/);
  window.close();
});

test('renderSchedaView(): senza durata/data inizio impostate, niente barra di progresso e niente riga "Durata" (mai un numero inventato)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    renderSchedaView();
  `);
  const card = document.querySelector('#programView .scheda-info-card');
  assert.equal(card.querySelector('.scheda-settimana-row'), null, 'senza durata+inizio non deve comparire la barra settimana');
  assert.ok(!/DURATA/i.test(card.textContent), 'senza durataSettimane non deve comparire la riga Durata');
  // "giorni/settimana" invece si calcola sempre dai giorni veri della scheda, non è un dato facoltativo
  assert.match(card.textContent, /GIORNI\/SETTIMANA/i);
  window.close();
});

test('renderSchedaView(): con durata e data inizio impostate, mostra "Settimana X di Y" e la barra di avanzamento coerente', async () => {
  const { window, document } = await loadApp();
  const dataInizio = isoOggiMeno(15); // 15 giorni fa => settimana 3 (floor(15/7)+1)
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase({}))};
    profilo.programs[0].durataSettimane = 8;
    profilo.programs[0].dataInizio = ${JSON.stringify(dataInizio)};
    state.profiles = [profilo]; activeProfileId = 'io';
    renderSchedaView();
    return document.querySelector('#programView .scheda-settimana-testo').textContent;
  `);
  assert.match(r, /Settimana 3 di 8/);
  const fillWidth = await run(window, `return document.querySelector('.scheda-progress-fill').style.width;`);
  assert.equal(fillWidth, Math.round(3/8*100) + '%');
  window.close();
});

test('renderSchedaView(): il nome del PT compare solo quando _mioPTNomeCache è valorizzata', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    _mioPTNomeCache = null;
    renderSchedaView();
  `);
  assert.equal(document.querySelector('.scheda-pt-riga'), null, 'senza PT non deve comparire la riga PT');
  await run(window, `
    _mioPTNomeCache = 'Luca Bianchi';
    renderSchedaView();
  `);
  assert.match(document.querySelector('.scheda-pt-riga').textContent, /Luca Bianchi/);
  window.close();
});

test('renderSchedaView(): "Note del PT" è una card a sé, presente solo se notePT è impostata', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    renderSchedaView();
  `);
  assert.equal(document.querySelector('.scheda-note-pt-card'), null);
  await run(window, `
    activeProgram().notePT = 'Aumenta il carico se riesci a completare tutte le serie.';
    renderSchedaView();
  `);
  const note = document.querySelector('.scheda-note-pt-card');
  assert.ok(note);
  assert.match(note.textContent, /Aumenta il carico/);
  window.close();
});

test('renderSchedaView(): i giorni sono <details>; quello di oggi è aperto, gli altri restano riassunti', async () => {
  const { window, document } = await loadApp();
  const oggiWd = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"][new Date().getDay()];
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    profilo.programs[0].days[1].weekday = ${JSON.stringify(oggiWd)}; // "Giorno B" è quello di oggi
    state.profiles = [profilo]; activeProfileId = 'io';
    renderSchedaView();
  `);
  const dettagli = [...document.querySelectorAll('#programView .day-view-accordion')];
  assert.equal(dettagli.length, 2);
  const aperti = dettagli.filter(d=>d.open);
  assert.equal(aperti.length, 1, 'un solo giorno deve essere aperto di default');
  assert.match(aperti[0].querySelector('.dname-riepilogo').textContent, /Giorno B/);
  assert.match(aperti[0].querySelector('.hint').textContent, /oggi/);
  window.close();
});

test('renderSchedaView(): la categoria del giorno compare come tag colorato, il recupero solo se impostato', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    profilo.programs[0].days[0].exercises[0].recupero = 90;
    state.profiles = [profilo]; activeProfileId = 'io';
    renderSchedaView();
  `);
  const giornoB = [...document.querySelectorAll('#programView .day-view-accordion')].find(d=>d.querySelector('.dname-riepilogo').textContent.includes('Giorno B'));
  assert.ok(giornoB.querySelector('.workout-tag.cat-cardio'), 'Giorno B (categoria cardio) deve avere il tag colorato');
  const giornoA = [...document.querySelectorAll('#programView .day-view-accordion')].find(d=>d.querySelector('.dname-riepilogo').textContent.includes('Giorno A'));
  assert.equal(giornoA.querySelector('.workout-tag'), null, 'Giorno A senza categoria non deve avere nessun tag');
  assert.match(giornoA.querySelector('.day-view-ex-stats').textContent, /90s recupero/);
  window.close();
});

test('editor scheda: renderDayEditors() disegna i giorni come <details class="day-accordion">, con riepilogo "nome · N esercizi" quando chiusi', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [
      { key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null, exercises:[{name:'Panca Piana', sets:3, reps:'10', recupero:null, muscles:[]}] },
      { key:'B', name:'Giorno B', weekday:'Mercoledì', categoria:null, exercises:[] }
    ];
    renderDayEditors();
  `);
  const accordion = [...document.querySelectorAll('#dayEditors .day-accordion')];
  assert.equal(accordion.length, 2);
  assert.match(accordion[0].querySelector('.dname-riepilogo').textContent, /Giorno A/);
  assert.match(accordion[0].querySelector('.hint').textContent, /1 esercizio\b/);
  assert.match(accordion[1].querySelector('.hint').textContent, /0 esercizi\b/);
  // dentro resta l'editor di sempre: campo nome, select giorno/categoria, lista esercizi
  assert.ok(accordion[0].querySelector('.ex-list[data-di="0"]'));
  window.close();
});

test('editor scheda: "un giorno alla volta" — aprendo un giorno, gli altri si chiudono da soli', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [
      { key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null, exercises:[] },
      { key:'B', name:'Giorno B', weekday:'Mercoledì', categoria:null, exercises:[] }
    ];
    renderDayEditors();
    const [d1, d2] = document.querySelectorAll('#dayEditors .day-accordion');
    d1.open = true;
    d1.dispatchEvent(new window.Event('toggle'));
  `);
  let stato = await run(window, `
    const [d1, d2] = document.querySelectorAll('#dayEditors .day-accordion');
    return { d1: d1.open, d2: d2.open };
  `);
  assert.deepEqual(stato, { d1: true, d2: false });

  await run(window, `
    const [d1, d2] = document.querySelectorAll('#dayEditors .day-accordion');
    d2.open = true;
    d2.dispatchEvent(new window.Event('toggle'));
  `);
  stato = await run(window, `
    const [d1, d2] = document.querySelectorAll('#dayEditors .day-accordion');
    return { d1: d1.open, d2: d2.open };
  `);
  assert.deepEqual(stato, { d1: false, d2: true }, 'aprire il secondo giorno deve richiudere il primo');
  window.close();
});

test('editor scheda: il campo "rec" (recupero, facoltativo) si salva su editingDays', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null,
      exercises:[{name:'Panca Piana', sets:3, reps:'10', recupero:null, muscles:[]}] }];
    renderDayEditors();
    const rec = document.querySelector('.ex-list[data-di="0"] input.rec');
    rec.value = '90';
    rec.dispatchEvent(new window.Event('input'));
  `);
  const r = await run(window, `return editingDays[0].exercises[0].recupero;`);
  assert.equal(r, 90);

  await run(window, `
    const rec = document.querySelector('.ex-list[data-di="0"] input.rec');
    rec.value = '';
    rec.dispatchEvent(new window.Event('input'));
  `);
  const r2 = await run(window, `return editingDays[0].exercises[0].recupero;`);
  assert.equal(r2, null, 'campo vuotato deve tornare null, non 0 (facoltativo, non un numero inventato)');
  window.close();
});

test('scheda: "Aggiorna scheda" salva durata settimane, data inizio e note per il cliente sul programma attivo', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    renderNewProgramForm();
    document.getElementById('newProgramDurata').value = '8';
    document.getElementById('newProgramDataInizio').value = '2026-08-05';
    document.getElementById('newProgramNotePT').value = 'Buon lavoro!';
    document.getElementById('updateProgramBtn').click();
    const p = state.profiles.find(x=>x.id==='io').programs.find(x=>x.id==='p1');
    return { durataSettimane: p.durataSettimane, dataInizio: p.dataInizio, notePT: p.notePT };
  `);
  assert.deepEqual(r, { durataSettimane: 8, dataInizio: '2026-08-05', notePT: 'Buon lavoro!' });
  window.close();
});

test('header Scheda: la matita apre "Modifica scheda", la freccia indietro torna alla vista', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
  `);
  assert.notEqual(document.getElementById('programViewBlock').style.display, 'none');
  assert.notEqual(document.getElementById('programEditBlock').style.display, 'block');

  await run(window, `document.getElementById('schedaEditBtn').click();`);
  assert.equal(document.getElementById('programViewBlock').style.display, 'none');
  assert.equal(document.getElementById('programEditBlock').style.display, 'block');

  await run(window, `document.getElementById('schedaTornaVediBtn').click();`);
  assert.equal(document.getElementById('programViewBlock').style.display, 'block');
  assert.equal(document.getElementById('programEditBlock').style.display, 'none');
  window.close();
});

test('header Scheda: "+ Nuova scheda", dopo conferma, svuota il modulo e apre l\'editor pronto per il primo giorno', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('nuovaSchedaBtn').click();
  `);
  // customConfirm mostra un overlay vero: va confermato per proseguire
  assert.ok(document.getElementById('customConfirmOk'), 'deve comparire la conferma prima di svuotare qualunque cosa');
  await run(window, `document.getElementById('customConfirmOk').click();`);
  const r = await run(window, `return { nGiorni: editingDays.length, editVisibile: document.getElementById('programEditBlock').style.display };`);
  assert.equal(r.nGiorni, 0);
  assert.equal(r.editVisibile, 'block');
  window.close();
});
