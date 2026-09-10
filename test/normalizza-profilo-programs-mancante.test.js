'use strict';
// 10/09/2026: trovato in produzione un profilo reale (creato senza passare
// da profiloVuotoPerCloud()/pt-area.js) con "programs" del tutto assente
// dai dati, non solo vuoto — a differenza di activeProgram() (già corretto
// in precedenza), altri punti che leggono prof.programs direttamente
// (scheda-editor.js: .find/.filter/.push, volume-muscolare.js: .find) non
// hanno nessun controllo e andavano in crash con "undefined is not an
// object (evaluating 'prof.programs.find')" appena si apriva Scheda o
// Storico con quel profilo. normalizzaProfilo() gira su ogni profilo
// caricato: è il punto giusto per garantire l'array una volta sola.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

// 10/09/2026 (correzione di una regressione mia): la prima versione di questo
// fix metteva un array VUOTO. Sbagliato: in tutta l'app vale l'invariante "un
// profilo ha sempre almeno una scheda" (la garantiscono newProfile() e
// pt-area.js), e chi usa activeProgram() lo dà per scontato — tabs-header.js:296
// fa `p.name` sul risultato. Con l'array vuoto activeProgram() tornava null e
// il primo renderHeader() dopo il login moriva con "Cannot read properties of
// null (reading 'name')": l'accesso falliva col generico "Qualcosa non ha
// funzionato" per qualunque profilo senza schede.
test('normalizzaProfilo(): un profilo con "programs" del tutto assente riceve una scheda vuota di riserva (non un array vuoto)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = { id:'x', name:'X', email:'x@test.it' }; // niente "programs" né "activeProgramId"
    normalizzaProfilo(p);
    return { n: p.programs.length, primo: p.programs[0], activeProgramId: p.activeProgramId };
  `);
  assert.equal(r.n, 1, 'deve esserci sempre almeno una scheda');
  assert.ok(r.primo && r.primo.id, 'la scheda di riserva deve essere una scheda vera, con un id');
  assert.deepEqual(r.primo.days, [], 'ma vuota: nessun giorno di allenamento inventato');
  assert.equal(r.activeProgramId, null);
});

test('normalizzaProfilo(): un profilo con "programs" vuoto ([]) riceve anch\'esso la scheda di riserva, così activeProgram() non torna mai null', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = { id:'x', name:'X', email:'x@test.it', programs: [], activeProgramId: null };
    normalizzaProfilo(p);
    state.profiles = [p]; activeProfileId = 'x';
    return { n: p.programs.length, schedaAttiva: !!activeProgram() };
  `);
  assert.equal(r.n, 1);
  assert.equal(r.schedaAttiva, true, 'activeProgram() deve restituire una scheda, non null');
});

test('normalizzaProfilo(): un "programs" già valido non viene toccato', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = { id:'x', name:'X', email:'x@test.it', programs:[{id:'p1'}], activeProgramId:'p1' };
    normalizzaProfilo(p);
    return { programs: p.programs, activeProgramId: p.activeProgramId };
  `);
  assert.deepEqual(r.programs, [{id:'p1'}]);
  assert.equal(r.activeProgramId, 'p1');
});

// 10/09/2026 (stesso profilo, scoperto un attimo dopo): "programs" non era
// l'unico campo mancante — il profilo reale aveva in "dati" SOLO
// checkinVistaPtIl/dietaVistaPtIl (impostati da segnaVistaPT(), che scrive
// senza mai passare da normalizzaProfilo()), niente altro. "logs" in
// particolare è letto senza controlli in home.js/registra.js/storico/
// dieta.js/tabs-header.js/costanti.js/recupero-codici.js: bastava aprire la
// Home per andare in crash con "undefined is not an object (evaluating
// 'prof.logs.forEach')" — esattamente ciò che succedeva subito dopo un
// accesso riuscito con quel profilo (mostraHome() è l'ultimo passo di
// dopoAccessoOnline()).
test('normalizzaProfilo(): un profilo "minimo" (solo pochi campi, come capita a un cliente creato fuori dal percorso normale) ottiene tutti i default critici, non solo "programs"', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const p = { checkinVistaPtIl:'2026-09-10T19:19:47.634Z', dietaVistaPtIl:'2026-09-10T19:18:57.103Z' };
    normalizzaProfilo(p);
    return {
      logs: p.logs, measurements: p.measurements, mealLogs: p.mealLogs, waterLogs: p.waterLogs,
      checkins: p.checkins, customExercises: p.customExercises, customFoods: p.customFoods,
      programs: p.programs, activeProgramId: p.activeProgramId, avatarUrl: p.avatarUrl, sesso: p.sesso
    };
  `);
  assert.deepEqual(r.logs, [], 'logs mancante deve diventare un array vuoto, non restare undefined');
  assert.deepEqual(r.measurements, []);
  assert.deepEqual(r.mealLogs, []);
  assert.deepEqual(r.waterLogs, []);
  assert.deepEqual(r.checkins, []);
  assert.deepEqual(r.customExercises, {});
  assert.deepEqual(r.customFoods, {});
  assert.equal(r.programs.length, 1, 'sempre almeno una scheda, altrimenti activeProgram() torna null e renderHeader() muore');
  assert.equal(r.activeProgramId, null);
  assert.equal(r.avatarUrl, null);
  assert.equal(r.sesso, null);
});
