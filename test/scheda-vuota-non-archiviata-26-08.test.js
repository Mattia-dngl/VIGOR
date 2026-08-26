'use strict';
// Feedback dopo il ventesimo giro (26/08/2026, terzo giro di correzioni dello
// stesso giorno), su "Schede archiviate" (Storico) e sull'editor esercizio:
// 1) Il testo introduttivo sotto "Schede archiviate" si legge male (colore
//    troppo tenue, --text-faint su sfondo chiaro).
// 2) Il dettaglio di una versione archiviata non distingue allenamento e
//    dieta — richiesta esplicita: "differenzia la dieta con palestra".
// 3) Non bisogna archiviare schede vuote — se una versione non è mai stata
//    compilata (né allenamento né dieta), va scartata del tutto, non tenuta
//    in giro nell'elenco. Esempio concreto dell'utente: la scheda "bianca"
//    di partenza di un profilo nuovo, mai toccata, finita comunque tra le
//    versioni archiviate solo perché nel frattempo la dieta era stata
//    aggiornata.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp, run } = require('./helpers/loadApp.js');

function dietaVuotaBlank(){
  const WD = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];
  const d = {};
  WD.forEach(w=>{ d[w] = { libera:false, palestra:false, colazione:"", pranzo:"", spuntino:"", cena:"" }; });
  return d;
}

function profiloBase(overrides){
  return Object.assign({
    id: 'io', name: 'Io', email: 'io@test.it', createdAt:'2026-01-01', logs: [], measurements: [],
    customExercises: {}, customFoods: {}, mealLogs: [],
    programs: [{
      id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      durataSettimane:null, dataInizio:null, notePT:null,
      days: [],
      dietInfo: {}, diet: dietaVuotaBlank()
    }],
    activeProgramId: 'p1'
  }, overrides || {});
}

// ---------------------------------------------------------------
// 1) programmaVuoto() / giorniCompilati() / dietaCompilata() — funzioni pure
// ---------------------------------------------------------------

test('programmaVuoto(): una scheda mai compilata (niente giorni, dieta tutta vuota) è vuota', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return programmaVuoto({ days: [], diet: ${JSON.stringify(dietaVuotaBlank())} });
  `);
  assert.equal(r, true);
  window.close();
});

test('programmaVuoto(): con almeno un esercizio in un giorno NON è vuota, anche se la dieta è vuota', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return programmaVuoto({
      days: [{ key:'A', name:'A', weekday:'Lunedì', exercises:[{name:'Panca Piana', sets:3, reps:'10'}] }],
      diet: ${JSON.stringify(dietaVuotaBlank())}
    });
  `);
  assert.equal(r, false);
  window.close();
});

test('programmaVuoto(): con la dieta compilata su un giorno NON è vuota, anche senza giorni di allenamento', async () => {
  const { window } = await loadApp();
  const dieta = dietaVuotaBlank();
  dieta['Lunedì'].colazione = 'Uova e avena';
  const r = await run(window, `
    return programmaVuoto({ days: [], diet: ${JSON.stringify(dieta)} });
  `);
  assert.equal(r, false);
  window.close();
});

test('programmaVuoto(): un giorno "libero" con solo il testo di default compilato conta come dieta compilata', async () => {
  const { window } = await loadApp();
  const dieta = dietaVuotaBlank();
  dieta['Domenica'] = { libera:true, testo:'Mangia quello che vuoi.' };
  const r = await run(window, `
    return programmaVuoto({ days: [], diet: ${JSON.stringify(dieta)} });
  `);
  assert.equal(r, false);
  window.close();
});

test('programmaVuoto(): un giorno con array esercizi presente ma vuoto conta comunque come "senza allenamento"', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return programmaVuoto({
      days: [{ key:'A', name:'A', weekday:'Lunedì', exercises:[] }],
      diet: ${JSON.stringify(dietaVuotaBlank())}
    });
  `);
  assert.equal(r, true);
  window.close();
});

// ---------------------------------------------------------------
// 2) Non archiviare, scartare: i tre punti che impostano/evitano archivedAt
// ---------------------------------------------------------------

test('"Salva scheda" (nuova): se la scheda attuale era vuota, viene scartata invece di archiviata', async () => {
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
    editingDays = [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null, exercises:[
      { name:'Squat', sets:4, reps:'8', recupero:null, muscles:[] }
    ] }];
    renderDayEditors();
    document.getElementById('newProgramName').value = 'Prima scheda vera';
    document.getElementById('saveNewProgramBtn').click();
    const prof = state.profiles[0];
    return {
      nProgrammi: prof.programs.length,
      c1Presente: !!prof.programs.find(p=>p.id==='p1'),
      attivaNome: prof.programs.find(p=>p.id===prof.activeProgramId).name
    };
  `);
  assert.equal(r2.nProgrammi, 1, 'la vecchia scheda vuota non deve restare in giro, nemmeno archiviata');
  assert.equal(r2.c1Presente, false);
  assert.equal(r2.attivaNome, 'Prima scheda vera');
  window.close();
});

test('"Salva dieta": se la scheda attuale era vuota, viene scartata invece di archiviata', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('diet');
    renderDietEditForm();
    editingDiet['Lunedì'].colazione = 'Yogurt e frutta';
    document.getElementById('saveDietBtn').click();
    const prof = state.profiles[0];
    return {
      nProgrammi: prof.programs.length,
      c1Presente: !!prof.programs.find(p=>p.id==='p1')
    };
  `);
  assert.equal(r.nProgrammi, 1);
  assert.equal(r.c1Presente, false);
  window.close();
});

test('"Salva scheda": una versione con SOLO la dieta compilata (nessun esercizio) NON viene scartata, resta archiviata normalmente', async () => {
  const { window } = await loadApp();
  const dieta = dietaVuotaBlank();
  dieta['Lunedì'].colazione = 'Uova e avena';
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase({ programs: [{
      id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      durataSettimane:null, dataInizio:null, notePT:null, days: [], dietInfo:{}, diet: dieta
    }] }))};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    document.getElementById('nuovaSchedaBtn').click();
  `);
  await run(window, `document.getElementById('customConfirmOk').click();`);
  const r2 = await run(window, `
    editingDays = [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null, exercises:[
      { name:'Squat', sets:4, reps:'8', recupero:null, muscles:[] }
    ] }];
    renderDayEditors();
    document.getElementById('saveNewProgramBtn').click();
    const prof = state.profiles[0];
    return {
      nProgrammi: prof.programs.length,
      p1Archiviata: !!prof.programs.find(p=>p.id==='p1')?.archivedAt
    };
  `);
  assert.equal(r2.nProgrammi, 2, 'la versione con la dieta compilata va tenuta, anche senza esercizi');
  assert.equal(r2.p1Archiviata, true);
  window.close();
});

test('riattivare una scheda archiviata: se quella attualmente attiva era vuota, viene scartata invece di archiviata', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase({
      programs: [
        { id:'pVecchia', name:'Scheda precedente', createdAt:'2025-12-01', archivedAt:'2026-01-01', scadenza:null,
          durataSettimane:null, dataInizio:null, notePT:null,
          days:[{ key:'A', name:'Full body', weekday:'Lunedì', exercises:[{name:'Stacco', sets:3, reps:'5'}] }],
          dietInfo:{}, diet: dietaVuotaBlank() },
        { id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
          durataSettimane:null, dataInizio:null, notePT:null, days:[], dietInfo:{}, diet: dietaVuotaBlank() }
      ]
    }))};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    renderArchiveList();
  `);
  const r2 = await run(window, `
    document.querySelector('[data-reactivate="pVecchia"]').click();
    document.getElementById('customConfirmOk').click();
    const prof = state.profiles[0];
    return {
      nProgrammi: prof.programs.length,
      p1Presente: !!prof.programs.find(p=>p.id==='p1'),
      attivoId: prof.activeProgramId
    };
  `);
  assert.equal(r2.nProgrammi, 1, "la scheda vuota che era attiva va scartata, non archiviata");
  assert.equal(r2.p1Presente, false);
  assert.equal(r2.attivoId, 'pVecchia');
  window.close();
});

test('renderArchiveList(): ripulisce da sola le versioni già archiviate ma mai compilate (dati vecchi)', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloBase({
      programs: [
        { id:'pVuotaArchiviata', name:'La mia scheda', createdAt:'2025-08-11', archivedAt:'2025-08-14', scadenza:null,
          durataSettimane:null, dataInizio:null, notePT:null, days:[], dietInfo:{}, diet: dietaVuotaBlank() },
        { id:'p1', name:'Scheda attuale', createdAt:'2025-08-14', archivedAt:null, scadenza:null,
          durataSettimane:null, dataInizio:null, notePT:null,
          days:[{ key:'A', name:'A', weekday:'Lunedì', exercises:[{name:'Panca Piana', sets:3, reps:'10'}] }],
          dietInfo:{}, diet: dietaVuotaBlank() }
      ]
    }))};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
    renderArchiveList();
    return { nProgrammi: state.profiles[0].programs.length };
  `);
  assert.equal(r.nProgrammi, 1, "la versione archiviata ma vuota va rimossa in automatico");
  assert.match(document.getElementById('archiveList').textContent, /Nessuna scheda precedente/);
  window.close();
});

// ---------------------------------------------------------------
// 3) Dettaglio di una versione archiviata: sezioni separate Allenamento/Dieta
// ---------------------------------------------------------------

test('renderProgramDetailHtml(): sezioni "Allenamento" e "Dieta" separate, con messaggio esplicito quando una manca', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = {
      days: [{ key:'A', name:'Gambe', weekday:'Lunedì', exercises:[{name:'Squat', sets:4, reps:'8'}] }],
      diet: ${JSON.stringify(dietaVuotaBlank())}
    };
    return renderProgramDetailHtml(p);
  `);
  assert.match(r, /Allenamento/);
  assert.match(r, /Dieta/);
  assert.match(r, /Squat/);
  assert.match(r, /Nessuna dieta compilata in questa versione\./);
  window.close();
});

test('renderProgramDetailHtml(): con dieta compilata e nessun allenamento, mostra il messaggio esplicito solo lato allenamento', async () => {
  const { window } = await loadApp();
  const dieta = dietaVuotaBlank();
  dieta['Martedì'].pranzo = 'Pollo e riso';
  const r = await run(window, `
    const p = { days: [], diet: ${JSON.stringify(dieta)} };
    return renderProgramDetailHtml(p);
  `);
  assert.match(r, /Nessun allenamento salvato in questa versione\./);
  assert.match(r, /Pollo e riso/);
  window.close();
});

// ---------------------------------------------------------------
// 4) Leggibilità del testo introduttivo
// ---------------------------------------------------------------

test('Storico → "Schede archiviate": il testo introduttivo usa un colore leggibile (--text-dim), non quello tenue di default', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    const profilo = ${JSON.stringify(profiloBase())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    vaiA('program');
  `);
  const details = Array.from(document.querySelectorAll('#programStoricoBlock details.details-card'))
    .find(d => d.querySelector('summary')?.textContent === 'Schede archiviate');
  const intro = details.querySelector('p.hint');
  assert.ok(intro, 'il paragrafo introduttivo deve esistere');
  assert.match(intro.getAttribute('style') || '', /--text-dim/);
  window.close();
});

test('CSS: le sezioni del dettaglio archiviato (titoli e stato vuoto) usano --text-dim, non --text-faint', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.match(css, /\.archive-detail-titolo\{[^}]*color:var\(--text-dim\)/);
  assert.match(css, /\.archive-detail-vuoto\{[^}]*color:var\(--text-dim\)/);
});
