'use strict';
// Feedback dopo la consegna della correzione "schermo intero" (26/08/2026,
// stesso giorno, secondo giro di correzioni): due richieste distinte.
//
// 1) "Modifica scheda"/"Nuova scheda" mostravano SEMPRE entrambi i bottoni
//    di salvataggio ("Aggiorna scheda" e "Salva come nuova versione") più
//    una lunga spiegazione di cosa fa ciascuno — inutile quando si sta solo
//    aggiornando la scheda già attiva. Richiesta: un solo bottone alla
//    volta, a seconda di come si è entrati nell'editor (matita = aggiorna,
//    "+ Nuova scheda" = crea). "Schede archiviate" spostata da lì a Storico.
// 2) L'editor di un esercizio era "troppo incasinato": il nome (una <select>)
//    era schiacciato accanto a serie/rip/rec e si troncava (es. "Panca
//    Pi…"), muscoli coinvolti e tecnica speciale restavano sempre spiegati
//    per intero. Richiesta: più leggibile e più compatto.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, run } = require('./helpers/loadApp.js');

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
        ] }
      ],
      dietInfo:{}, diet:{}
    }],
    activeProgramId: 'p1'
  }, overrides || {});
}

// ---------------------------------------------------------------
// 1) Un solo bottone di salvataggio alla volta
// ---------------------------------------------------------------

test('editor scheda via matita ("Modifica scheda"): un solo bottone "Aggiorna scheda", niente campo Nome né spiegazione lunga', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('schedaEditBtn').click();
  `);
  assert.equal(document.getElementById('programEditTitolo2').textContent, 'Modifica scheda');
  assert.equal(document.getElementById('updateProgramBtn').style.display, 'block');
  assert.equal(document.getElementById('saveNewProgramBtn').style.display, 'none', '"Salva come nuova versione" non serve mentre si aggiorna');
  assert.equal(document.getElementById('newProgramNameWrap').style.display, 'none');
  assert.equal(document.getElementById('programEditIntroWrap').style.display, 'none');
  assert.equal(document.getElementById('programEditIntroHint').style.display, 'none');
  window.close();
});

test('editor scheda via "+ Nuova scheda": un solo bottone "Salva scheda", campo Nome e avviso breve sull\'archiviazione', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('nuovaSchedaBtn').click();
  `);
  await run(window, `document.getElementById('customConfirmOk').click();`);
  assert.equal(document.getElementById('programEditTitolo2').textContent, 'Nuova scheda');
  assert.equal(document.getElementById('updateProgramBtn').style.display, 'none');
  assert.equal(document.getElementById('saveNewProgramBtn').style.display, 'block');
  assert.equal(document.getElementById('saveNewProgramBtn').textContent, 'Salva scheda');
  assert.equal(document.getElementById('newProgramNameWrap').style.display, 'block');
  assert.equal(document.getElementById('programEditHintNuova').style.display, 'block');
  window.close();
});

test('tornare a "Vedi" e riaprire con la matita torna sempre in modalità "modifica", anche dopo essere stati in "nuova"', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('nuovaSchedaBtn').click();
  `);
  await run(window, `document.getElementById('customConfirmOk').click();`);
  await run(window, `document.getElementById('schedaTornaVediBtn').click();`);
  await run(window, `document.getElementById('schedaEditBtn').click();`);
  assert.equal(document.getElementById('programEditTitolo2').textContent, 'Modifica scheda');
  assert.equal(document.getElementById('updateProgramBtn').style.display, 'block');
  assert.equal(document.getElementById('saveNewProgramBtn').style.display, 'none');
  window.close();
});

test('salvare con "Aggiorna scheda" (modo "modifica") continua a funzionare come prima', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('schedaEditBtn').click();
    document.getElementById('newProgramDurata').value = '6';
    document.getElementById('updateProgramBtn').click();
    return state.profiles[0].programs.find(p=>p.id==='p1').durataSettimane;
  `);
  assert.equal(r, 6);
  window.close();
});

test('salvare con "Salva scheda" (modo "nuova") archivia quella attuale e attiva la nuova, come faceva prima "Salva come nuova versione"', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('nuovaSchedaBtn').click();
  `);
  await run(window, `document.getElementById('customConfirmOk').click();`);
  const r2 = await run(window, `
    editingDays = [{ key:'A', name:'Nuovo giorno', weekday:'Lunedì', categoria:null, exercises:[] }];
    renderDayEditors();
    document.getElementById('newProgramName').value = 'Fase 3';
    document.getElementById('saveNewProgramBtn').click();
    const prof = state.profiles[0];
    return {
      nProgrammi: prof.programs.length,
      vecchioArchiviato: !!prof.programs.find(p=>p.id==='p1').archivedAt,
      nuovoAttivo: prof.programs.find(p=>p.id===prof.activeProgramId).name
    };
  `);
  assert.equal(r2.nProgrammi, 2);
  assert.equal(r2.vecchioArchiviato, true);
  assert.equal(r2.nuovoAttivo, 'Fase 3');
  window.close();
});

test('PT che modifica la scheda di un cliente vede ancora entrambi i bottoni (comportamento invariato: non ha un "+Nuova scheda" separato)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id:'pt-1' };
    document.body.insertAdjacentHTML('beforeend', '<div id="ptSchedaEditorSlot"></div>');
    _clienteAperto = {
      riga: { id:'cli-1', nome:'Cliente Uno', email:'uno@test.it', dati: {
        logs:[], measurements:[], mealLogs:[], customExercises:{}, customFoods:{},
        programs:[{ id:'p1', name:'Scheda Cliente', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
          durataSettimane:null, dataInizio:null, notePT:null,
          days:[{key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null, exercises:[]}], dietInfo:{}, diet:{} }],
        activeProgramId:'p1'
      }},
      rapporto: { id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:false }
    };
    mostraEditorSchedaInlinePT();
  `);
  assert.equal(document.getElementById('updateProgramBtn').style.display, 'block');
  assert.equal(document.getElementById('saveNewProgramBtn').style.display, 'block');
  assert.equal(document.getElementById('saveNewProgramBtn').textContent, 'Salva come nuova versione');
  assert.equal(document.getElementById('programEditTitolo2').textContent, 'Scheda di Cliente Uno');
  assert.equal(document.getElementById('programEditIntroWrap').style.display, '', 'per il PT la spiegazione resta visibile come prima');
  window.close();
});

// ---------------------------------------------------------------
// "Schede archiviate": da "Modifica scheda" a Storico
// ---------------------------------------------------------------

test('"Schede archiviate" non è più dentro "Modifica scheda": ora vive in Storico', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
  `);
  const archiveList = document.getElementById('archiveList');
  assert.ok(archiveList, "l'elemento #archiveList deve esistere ancora (stessa renderArchiveList di sempre)");
  assert.equal(document.getElementById('programEditBlock').contains(archiveList), false);
  assert.equal(document.getElementById('programStoricoBlock').contains(archiveList), true);
  window.close();
});

test('Storico mostra la tendina "Schede archiviate", sempre visibile qualunque sia il segmento scelto', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('storico');
  `);
  const details = Array.from(document.querySelectorAll('#programStoricoBlock details.details-card'))
    .find(d => d.querySelector('summary')?.textContent === 'Schede archiviate');
  assert.ok(details, 'deve esserci una tendina "Schede archiviate" dentro Storico');
  window.close();
});

// ---------------------------------------------------------------
// 2) Editor esercizio meno incasinato
// ---------------------------------------------------------------

test('editor esercizio: il nome ha una riga tutta sua, separata da serie/rip/rec (non più troncato)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null,
      exercises:[{name:'Panca Piana', sets:3, reps:'10', recupero:null, muscles:['Petto']}] }];
    renderDayEditors();
  `);
  const top = document.querySelector('.ex-list[data-di="0"] .exercise-edit-top');
  assert.ok(top, 'deve esserci una riga dedicata a numero+nome+rimuovi');
  assert.ok(top.querySelector('.ex-name-input'), 'il nome deve stare in questa riga');
  const row = document.querySelector('.ex-list[data-di="0"] .exercise-edit-row');
  assert.equal(row.contains(document.querySelector('.ex-name-input')), false, 'il nome non deve più stare schiacciato nella riga serie/rip/rec');
  window.close();
});

test('editor esercizio: "Muscoli coinvolti" e "Tecnica speciale" sono tendine chiuse di default, con un riassunto in una riga', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null,
      exercises:[{name:'Panca Piana', sets:3, reps:'10', recupero:null, muscles:['Petto','Tricipiti']}] }];
    renderDayEditors();
  `);
  const dettagli = document.querySelectorAll('.ex-list[data-di="0"] .ex-sub-details');
  assert.equal(dettagli.length, 2, 'devono esserci due tendine: Muscoli coinvolti e Tecnica speciale');
  assert.equal(dettagli[0].open, false, '"Muscoli coinvolti" chiusa di default');
  assert.equal(dettagli[1].open, false, '"Tecnica speciale" chiusa di default se nessuna tecnica è attiva');
  assert.equal(dettagli[0].querySelector('.ex-sub-riassunto').textContent, 'Petto, Tricipiti');
  assert.equal(dettagli[1].querySelector('.ex-sub-riassunto').textContent, 'Nessuna');
  window.close();
});

test('editor esercizio: "Tecnica speciale" è aperta di default se l\'esercizio ha già dropset/rest-pause/superset', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null,
      exercises:[{name:'Panca Piana', sets:3, reps:'10', recupero:null, muscles:[],
        dropset:{tipo:'dropset', drops:[{reps:'8', riduzione:25}]}}] }];
    renderDayEditors();
  `);
  const tecnica = document.querySelectorAll('.ex-list[data-di="0"] .ex-sub-details')[1];
  assert.equal(tecnica.open, true);
  assert.equal(tecnica.querySelector('.ex-sub-riassunto').textContent, 'Dropset');
  window.close();
});

test('editor esercizio: scegliere un muscolo aggiorna il riassunto senza richiudere la tendina (niente re-render completo)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null,
      exercises:[{name:'Panca Piana', sets:3, reps:'10', recupero:null, muscles:[]}] }];
    renderDayEditors();
    document.querySelectorAll('.ex-list[data-di="0"] .ex-sub-details')[0].open = true;
    document.querySelector('.ex-list[data-di="0"] .muscle-chip[data-m="Petto"]').click();
  `);
  const details0 = document.querySelectorAll('.ex-list[data-di="0"] .ex-sub-details')[0];
  assert.equal(details0.open, true, 'la tendina non deve richiudersi da sola dopo aver scelto un muscolo');
  assert.equal(details0.querySelector('.ex-sub-riassunto').textContent, 'Petto');
  const r = await run(window, `return editingDays[0].exercises[0].muscles;`);
  assert.deepEqual(r, ['Petto']);
  window.close();
});

test('editor esercizio: il campo "rec" resta al suo posto e funziona (regressione)', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    editingDays = [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null,
      exercises:[{name:'Panca Piana', sets:3, reps:'10', recupero:null, muscles:[]}] }];
    renderDayEditors();
    const rec = document.querySelector('.ex-list[data-di="0"] input.rec');
    rec.value = '75';
    rec.dispatchEvent(new window.Event('input'));
  `);
  const r = await run(window, `return editingDays[0].exercises[0].recupero;`);
  assert.equal(r, 75);
  window.close();
});

test('CSS: la riga serie/rip/rec è una griglia a 3 colonne, il nome dell\'esercizio ha più spazio', async () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.match(css, /\.exercise-edit-row\{display:grid; grid-template-columns:repeat\(3,1fr\);/, 'serie/rip/rec devono stare su una griglia a 3 colonne compatta');
  assert.match(css, /\.exercise-edit-top \.ex-name-input\{flex:1;/, 'il nome deve occupare tutto lo spazio libero della sua riga');
  assert.match(css, /\.ex-sub-details\{/, 'muscoli/tecnica devono essere tendine dedicate');
});
