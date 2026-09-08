'use strict';
// 08/09/2026: "Copia da scheda esistente", SOLO dentro "Nuova scheda" del PT
// (vedi #ptCopiaSchedaWrap in index.html, apriCopiaSchedaOverlay/
// copiaSchedaSelezionata in js/pt/pt-area.js). Copre:
// 1) il bottone/l'elenco compaiono SOLO in "Nuova scheda" del PT, mai in
//    "Modifica scheda";
// 2) si può copiare una propria scheda (del PT) o quella di un cliente
//    seguito ATTIVAMENTE, sempre come copia indipendente (clone profondo);
// 3) i permessi vengono ricontrollati DI NUOVO al momento della copia, non
//    solo quando si apre l'elenco: se il rapporto è terminato nel frattempo,
//    la copia viene rifiutata anche se l'elenco l'aveva già mostrata.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

// Finto Supabase con uno stato "server" condiviso e mutabile per rapporti_pt
// e profili: caricaRapporti()/leggiProfilo() leggono da qui SEMPRE fresco
// (nessuna cache), esattamente come deve fare la funzionalità sotto test.
function fakeSupabasePT(){
  return `{
    _rapportiServer: [],
    _profiliServer: {},
    from(table){
      const self = this;
      if(table === 'profili'){
        return {
          select(){ return this; },
          eq(col, val){ this._id = val; return this; },
          maybeSingle(){ return Promise.resolve({ data: self._profiliServer[this._id] || null, error: null }); },
          update(patch){
            const risultato = {
              eq(col, val){ risultato._id = val; return risultato; },
              select(){
                const riga = self._profiliServer[risultato._id];
                if(riga) Object.assign(riga, patch);
                return Promise.resolve({ data: riga ? [{ id: risultato._id }] : [], error: null });
              }
            };
            return risultato;
          }
        };
      }
      if(table === 'rapporti_pt'){
        return {
          select(cols){
            const filtri = {};
            const builder = {
              eq(col, val){ filtri[col] = val; return builder; },
              or(expr){
                const parts = expr.split(',').map(p => { const b = p.split('.'); return { col: b[0], val: b[2] }; });
                const rows = self._rapportiServer.filter(r => parts.some(p => String(r[p.col]) === String(p.val)));
                return Promise.resolve({ data: rows, error: null });
              },
              maybeSingle(){
                const rows = self._rapportiServer.filter(r => Object.keys(filtri).every(k => String(r[k]) === String(filtri[k])));
                return Promise.resolve({ data: rows[0] || null, error: null });
              }
            };
            return builder;
          }
        };
      }
      return { select(){ return this; }, eq(){ return this; }, or(){ return Promise.resolve({ data: [], error: null }); },
        update(){ return { eq(){ return Promise.resolve({ error: null }); } }; } };
    }
  }`;
}

function clienteBersaglio(){
  // Il cliente per cui il PT sta creando la nuova scheda (bersaglio della
  // copia, non sorgente): scheda propria irrilevante per questi test.
  return {
    id: 'cli-1', nome: 'Cliente Bersaglio', email: 'bersaglio@test.it',
    dati: {
      logs:[], measurements:[], mealLogs:[], customExercises:{}, customFoods:{},
      programs:[{ id:'pb1', name:'Scheda Bersaglio', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
        durataSettimane:null, dataInizio:null, notePT:null, days:[], dietInfo:{}, diet:{} }],
      activeProgramId:'pb1'
    }
  };
}

async function entraInNuovaSchedaPT(window, cliente, rapportiServer){
  await run(window, `
    utenteOnline = { id:'pt-1' };
    _rapporti = ${JSON.stringify([{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:false }])};
    sb = ${fakeSupabasePT()};
    sb._profiliServer['cli-1'] = ${JSON.stringify(cliente)};
    sb._rapportiServer = ${JSON.stringify(rapportiServer)};
    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');
    document.querySelector('.pt-tab[data-pttab="scheda"]').click();
    await new Promise(r => setTimeout(r, 0));
    document.getElementById('ptNuovaSchedaBtn').click();
  `);
  await run(window, `document.getElementById('customConfirmOk').click();`);
}

test('"Copia da scheda esistente" compare SOLO in "Nuova scheda", non in "Modifica scheda"', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBersaglio();
  await run(window, `
    utenteOnline = { id:'pt-1' };
    _rapporti = [{ id:'r-1', cliente_id:'cli-1', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:false }];
    sb = ${fakeSupabasePT()};
    sb._profiliServer['cli-1'] = ${JSON.stringify(cliente)};
    document.getElementById('areaPT').style.display = 'block';
    await apriCliente('cli-1');
    document.querySelector('.pt-tab[data-pttab="scheda"]').click();
    await new Promise(r => setTimeout(r, 0));
    document.getElementById('ptSchedaEditBtn').click();
  `);
  assert.equal(document.getElementById('ptCopiaSchedaWrap').style.display, 'none',
    'in "Modifica scheda" (matita) non deve comparire');

  await run(window, `
    document.getElementById('schedaTornaVediBtn').click();
    await new Promise(r => setTimeout(r, 0));
    document.getElementById('ptNuovaSchedaBtn').click();
  `);
  await run(window, `document.getElementById('customConfirmOk').click();`);
  assert.equal(document.getElementById('ptCopiaSchedaWrap').style.display, 'block',
    'in "Nuova scheda" deve comparire');
  window.close();
});

test('copiare una PROPRIA scheda del PT: giorni copiati, copia indipendente dall\'originale', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBersaglio();
  const ptProfilo = {
    id: 'pt-1', name: 'Io PT', email: 'pt@test.it', approvato: true,
    programs: [{ id: 'pp1', name: 'Piano Personale', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      durataSettimane: 8, dataInizio:null, notePT:null,
      days: [{ key:'A', name:'Giorno A', weekday:'Lunedì', categoria:null,
        exercises:[{ name:'Squat', sets:4, reps:'6', recupero:120, muscles:['Gambe'] }] }],
      dietInfo:{}, diet:{} }],
    activeProgramId: 'pp1',
    logs:[], measurements:[], mealLogs:[], customExercises:{}, customFoods:{}
  };
  await run(window, `
    state.profiles = [${JSON.stringify(ptProfilo)}];
    activeProfileId = 'pt-1';
  `);
  await entraInNuovaSchedaPT(window, cliente, []);

  const r = await run(window, `
    await apriCopiaSchedaOverlay();
    const listaHtml = document.getElementById('ptCopiaSchedaLista').innerHTML;
    const bottone = document.querySelector('[data-owner="me"][data-programma="pp1"]');
    return { listaHtml, trovato: !!bottone };
  `);
  assert.match(r.listaHtml, /Piano Personale/, 'la propria scheda deve comparire nell\'elenco');
  assert.equal(r.trovato, true);

  const r2 = await run(window, `
    await copiaSchedaSelezionata('me', 'pp1');
    // copia indipendente: mutare la copia non deve toccare l'originale del PT
    editingDays[0].name = 'Modificato dopo la copia';
    editingDays[0].exercises[0].sets = 1;
    return {
      editingDays,
      nome: document.getElementById('newProgramName').value,
      originaleIntatto: state.profiles[0].programs[0].days[0].name,
      originaleSetsIntatti: state.profiles[0].programs[0].days[0].exercises[0].sets
    };
  `);
  assert.equal(r2.editingDays.length, 1);
  assert.equal(r2.editingDays[0].exercises[0].name, 'Squat');
  assert.equal(r2.nome, 'Copia di Piano Personale');
  assert.equal(r2.originaleIntatto, 'Giorno A', 'la scheda originale del PT non deve essere toccata dalla modifica della copia');
  assert.equal(r2.originaleSetsIntatti, 4, 'i dati originali (sets) non devono cambiare');
  window.close();
});

test('copiare la scheda di un cliente seguito ATTIVAMENTE: copia indipendente dall\'originale', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBersaglio();
  const clienteSorgente = {
    id: 'cli-2', nome: 'Luca Bianchi', email: 'luca@test.it',
    dati: {
      logs:[], measurements:[], mealLogs:[], customExercises:{}, customFoods:{},
      programs:[{ id:'pluca1', name:'Scheda Luca', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
        durataSettimane:null, dataInizio:null, notePT:null,
        days:[{ key:'A', name:'Petto', weekday:'Martedì', categoria:null,
          exercises:[{ name:'Panca Piana', sets:3, reps:'10', recupero:90, muscles:['Petto'] }] }],
        dietInfo:{}, diet:{} }],
      activeProgramId:'pluca1'
    }
  };
  await entraInNuovaSchedaPT(window, cliente, [
    { id:'r-2', cliente_id:'cli-2', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:false }
  ]);
  await run(window, `sb._profiliServer['cli-2'] = ${JSON.stringify(clienteSorgente)};`);

  const r = await run(window, `
    await apriCopiaSchedaOverlay();
    return document.getElementById('ptCopiaSchedaLista').innerHTML;
  `);
  assert.match(r, /Scheda Luca/, 'la scheda di un cliente seguito deve comparire');
  assert.match(r, /Luca Bianchi/, 'deve indicare di chi è la scheda');

  const r2 = await run(window, `
    await copiaSchedaSelezionata('cli-2', 'pluca1');
    editingDays[0].exercises[0].sets = 99;   // muto la copia
    return {
      copiaSets: editingDays[0].exercises[0].sets,
      originaleSets: sb._profiliServer['cli-2'].dati.programs[0].days[0].exercises[0].sets,
      nome: document.getElementById('newProgramName').value
    };
  `);
  assert.equal(r2.copiaSets, 99);
  assert.equal(r2.originaleSets, 3, 'la scheda originale di Luca non deve essere toccata dalla modifica della copia');
  assert.equal(r2.nome, 'Copia di Scheda Luca');
  window.close();
});

test('un cliente NON seguito non compare nell\'elenco, e non se ne può copiare la scheda', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBersaglio();
  const nonSeguito = {
    id: 'cli-9', nome: 'Estraneo', email: 'estraneo@test.it',
    dati: { programs:[{ id:'pest', name:'Scheda Estranea', createdAt:'2026-01-01', archivedAt:null,
      days:[{ key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[{name:'Stacco', sets:3, reps:'5', muscles:[]}] }] }] }
  };
  // Nessun rapporto per cli-9: non è mai stato seguito da questo PT.
  await entraInNuovaSchedaPT(window, cliente, []);
  await run(window, `sb._profiliServer['cli-9'] = ${JSON.stringify(nonSeguito)};`);

  const r = await run(window, `
    await apriCopiaSchedaOverlay();
    return document.getElementById('ptCopiaSchedaLista').innerHTML;
  `);
  assert.doesNotMatch(r, /Scheda Estranea/, 'la scheda di chi non è seguito non deve comparire nell\'elenco');

  const r2 = await run(window, `
    const editingDaysPrima = JSON.stringify(editingDays);
    await copiaSchedaSelezionata('cli-9', 'pest');
    return { editingDaysInvariati: JSON.stringify(editingDays) === editingDaysPrima, toast: document.getElementById('toast').textContent };
  `);
  assert.equal(r2.editingDaysInvariati, true, 'un tentativo diretto di copia non deve avere alcun effetto senza un rapporto attivo');
  window.close();
});

test('permessi ricontrollati AL MOMENTO della copia: se il rapporto termina dopo aver aperto l\'elenco, la copia viene rifiutata', async () => {
  const { window, document } = await loadApp();
  const cliente = clienteBersaglio();
  const franco = {
    id: 'cli-franco', nome: 'Franco', email: 'franco@test.it',
    dati: { programs:[{ id:'pfranco', name:'Scheda Franco', createdAt:'2026-01-01', archivedAt:null,
      days:[{ key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[{name:'Rematore', sets:3, reps:'10', muscles:[]}] }] }] }
  };
  await entraInNuovaSchedaPT(window, cliente, [
    { id:'r-franco', cliente_id:'cli-franco', pt_id:'pt-1', stato:'attivo', puo_scheda:true, puo_dieta:false }
  ]);
  await run(window, `sb._profiliServer['cli-franco'] = ${JSON.stringify(franco)};`);

  // Il PT apre l'elenco mentre il rapporto è ancora attivo: Franco compare.
  const r = await run(window, `
    await apriCopiaSchedaOverlay();
    return document.getElementById('ptCopiaSchedaLista').innerHTML;
  `);
  assert.match(r, /Scheda Franco/);

  // ORA il rapporto termina (es. Franco smette di essere seguito) — l'elenco
  // aperto in memoria non lo sa ancora, ma il ricontrollo al momento della
  // copia deve accorgersene comunque, leggendo lo stato fresco.
  await run(window, `sb._rapportiServer.find(r => r.cliente_id === 'cli-franco').stato = 'terminato';`);

  const r2 = await run(window, `
    const editingDaysPrima = JSON.stringify(editingDays);
    const nomePrima = document.getElementById('newProgramName').value;
    await copiaSchedaSelezionata('cli-franco', 'pfranco');
    return {
      editingDaysInvariati: JSON.stringify(editingDays) === editingDaysPrima,
      nomeInvariato: document.getElementById('newProgramName').value === nomePrima,
      toast: document.getElementById('toast').textContent
    };
  `);
  assert.equal(r2.editingDaysInvariati, true, 'la scheda di Franco non deve essere copiata dopo la fine del rapporto');
  assert.equal(r2.nomeInvariato, true);
  assert.match(r2.toast, /non segui più questa persona/i);
  window.close();
});
