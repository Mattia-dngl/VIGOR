'use strict';
// Task 4a (roadmap, PIANO PRIMA confermato 07/09/2026), terzo pezzo: gli
// allenamenti hanno ora anche una tabella propria ("allenamenti"), non
// solo il blob JSONB. specchiaAllenamentiSuTabella() (js/core/stato.js)
// prova a scriverli lì dopo il salvataggio (registra.js) o dopo
// l'auto-segnatura dei giorni saltati (recupero-codici.js), senza mai
// bloccare né far dipendere il salvataggio locale/nel blob dal successo.
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

function fakeSb(){
  return `{
    _inserimenti: [],
    from(table){
      const self = this;
      if(table === 'allenamenti'){
        return { insert(righe){ self._inserimenti.push(righe); return Promise.resolve({ error:null }); } };
      }
      return { update(){ return { eq(){ return Promise.resolve({ error:null }); } }; } };
    }
  }`;
}

test('salvare un allenamento lo specchia sulla tabella allenamenti', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloConGiornoLunedi())};
    state.profiles = [profilo]; activeProfileId = 'io';
    utenteOnline = { id: 'io' };
    sb = ${fakeSb()};
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptAllenamento').click();
    logDateInput.value = '2026-02-02';
    renderDayChoices();
    document.getElementById('atempoIniziaBtn').click();
    document.getElementById('saveLogBtn').click();
    return { logs: activeProfile().logs, inserimenti: sb._inserimenti };
  `);
  assert.equal(r.logs.length, 1);
  assert.equal(r.inserimenti.length, 1);
  assert.equal(r.inserimenti[0].length, 1);
  assert.equal(r.inserimenti[0][0].id, r.logs[0].id);
  assert.equal(r.inserimenti[0][0].profilo_id, 'io');
  assert.equal(r.inserimenti[0][0].status, 'registrato');
  window.close();
});

test('salvare un allenamento senza Supabase: si salva comunque in locale, nessun tentativo di rete', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloConGiornoLunedi())};
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptAllenamento').click();
    logDateInput.value = '2026-02-02';
    renderDayChoices();
    document.getElementById('atempoIniziaBtn').click();
    document.getElementById('saveLogBtn').click();
    return activeProfile().logs;
  `);
  assert.equal(r.length, 1);
  window.close();
});

test('se la scrittura sulla tabella fallisce, l\'allenamento resta comunque salvato in locale', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = ${JSON.stringify(profiloConGiornoLunedi())};
    state.profiles = [profilo]; activeProfileId = 'io';
    utenteOnline = { id: 'io' };
    sb = { from(table){ if(table==='allenamenti') return { insert(){ return Promise.reject(new Error('rete assente')); } }; return { update(){ return { eq(){ return Promise.resolve({error:null}); } }; } }; } };
    mostraHome();
    document.getElementById('fabRegistraBtn').click();
    document.getElementById('fabOptAllenamento').click();
    logDateInput.value = '2026-02-02';
    renderDayChoices();
    document.getElementById('atempoIniziaBtn').click();
    document.getElementById('saveLogBtn').click();
    return activeProfile().logs;
  `);
  assert.equal(r.length, 1);
  window.close();
});

test('autoRegistraSaltati: i giorni segnati "saltato" in blocco vengono specchiati con un solo inserimento', async () => {
  const { window } = await loadApp();
  const profilo = {
    id: 'io', name: 'Io', email: 'io@test.it', logs: [], measurements: [], customExercises: {}, customFoods: {}, mealLogs: [],
    programs: [{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[{key:'A', name:'Giorno A', weekday:'Lunedì', exercises:[]}], dietInfo:{}, diet:{} }],
    activeProgramId: 'p1', autoSkip: undefined
  };
  const r = await run(window, `
    state.profiles = [${JSON.stringify(profilo)}]; activeProfileId = 'io';
    utenteOnline = { id: 'io' };
    sb = ${fakeSb()};
    const oggi = new Date('2026-02-16T12:00:00'); // qualche lunedì dopo, per far scattare l'auto-skip
    const originale = Date;
    globalThis.Date = class extends originale { constructor(...args){ if(args.length===0) return new originale(oggi); super(...args); } static now(){ return oggi.getTime(); } };
    const aggiunti = autoRegistraSaltati();
    globalThis.Date = originale;
    return { aggiunti, inserimenti: sb._inserimenti, logs: activeProfile().logs.length };
  `);
  assert.ok(r.aggiunti > 0, 'precondizione: deve aver trovato almeno un lunedì saltato');
  assert.equal(r.inserimenti.length, 1, 'un solo giro di inserimento, non uno per riga');
  assert.equal(r.inserimenti[0].length, r.aggiunti);
  window.close();
});
