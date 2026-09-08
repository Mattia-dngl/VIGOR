'use strict';
// Task 4a (roadmap, PIANO PRIMA confermato 07/09/2026), secondo pezzo: i
// check-in hanno ora anche una tabella propria ("checkin_periodico"), non
// solo il blob JSONB. specchiaCheckinSuTabella() (js/core/stato.js) prova a
// scrivere lì dopo ogni invio, senza mai bloccare né far dipendere il
// salvataggio locale/nel blob dal successo di quello.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloBase(overrides){
  return Object.assign({
    id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], checkins:[],
    customExercises:{}, customFoods:{}, mealLogs:[], waterLogs:[],
    programs:[{ id:'p1', name:'La mia scheda', createdAt:'2026-01-01', archivedAt:null, scadenza:null,
      days:[], dietInfo:{}, diet:{} }],
    activeProgramId:'p1'
  }, overrides||{});
}

function fakeSb(){
  return `{
    _insertChiamate: [],
    storage: { from(){ return { upload(){ return Promise.resolve({error:null}); } }; } },
    from(table){
      const self = this;
      if(table === 'checkin_periodico'){
        return { insert(riga){ self._insertChiamate.push(riga); return Promise.resolve({ error:null }); } };
      }
      if(table === 'rapporti_pt'){
        return { select(){ return this; }, or(){ return Promise.resolve({ data:[], error:null }); } };
      }
      return { update(){ return { eq(){ return Promise.resolve({ error:null }); } }; } };
    }
  }`;
}

async function compilaEInvia(window){
  await run(window, `
    apriCheckinCompilazione();
    document.getElementById('checkinPeso').value = '77';
    document.getElementById('checkinNota').value = 'Nota di prova';
    document.querySelector('#checkinSensazioneToggle .seg-btn[data-val="4"]').click();
    document.getElementById('checkinInviaBtn').click();
    await new Promise(r => setTimeout(r, 0));
  `);
}

test('invio check-in: viene specchiato sulla tabella checkin_periodico con gli stessi valori', async () => {
  const { window } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    utenteOnline = { id: 'io' };
    sb = ${fakeSb()};
  `);
  await compilaEInvia(window);
  const r = await run(window, `return { checkins: activeProfile().checkins, inserimenti: sb._insertChiamate };`);
  assert.equal(r.inserimenti.length, 1);
  assert.equal(r.inserimenti[0].id, r.checkins[0].id);
  assert.equal(r.inserimenti[0].profilo_id, 'io');
  assert.equal(r.inserimenti[0].peso, 77);
  assert.equal(r.inserimenti[0].sensazione, 4);
  assert.equal(r.inserimenti[0].nota, 'Nota di prova');
  window.close();
});

test('invio check-in senza Supabase: il check-in si salva comunque in locale, nessun tentativo di rete', async () => {
  const { window } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    sb = null;
  `);
  await compilaEInvia(window);
  const r = await run(window, `return activeProfile().checkins;`);
  assert.equal(r.length, 1);
  assert.equal(r[0].peso, 77);
  window.close();
});

test('invio check-in: se la scrittura sulla tabella fallisce, il check-in resta comunque salvato in locale', async () => {
  const { window } = await loadApp();
  await run(window, `
    state.profiles = [${JSON.stringify(profiloBase())}]; activeProfileId = 'io';
    utenteOnline = { id: 'io' };
    sb = {
      storage: { from(){ return { upload(){ return Promise.resolve({error:null}); } }; } },
      from(table){
        if(table === 'checkin_periodico') return { insert(){ return Promise.reject(new Error('rete assente')); } };
        if(table === 'rapporti_pt') return { select(){ return this; }, or(){ return Promise.resolve({data:[],error:null}); } };
        return { update(){ return { eq(){ return Promise.resolve({error:null}); } }; } };
      }
    };
  `);
  await compilaEInvia(window);
  const r = await run(window, `return activeProfile().checkins;`);
  assert.equal(r.length, 1, 'il fallimento dello specchio sulla tabella non deve far perdere il check-in');
  assert.equal(r[0].peso, 77);
  window.close();
});
