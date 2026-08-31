'use strict';
// Richiesta del 31/08/2026: chi è Personal Trainer non deve vedere, al login,
// la stessa home degli utenti normali — deve atterrare direttamente nella
// propria area riservata (areaPT). Da lì può comunque tornare alla sua home
// personale col tasto "Torna Home" (chiudiAreaPT), invariato.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function sbFinto(profiloRiga){
  return {
    from(table){
      if(table === 'profili'){
        return { select(){ return this; },
          eq(){ return { maybeSingle(){ return Promise.resolve({ data: profiloRiga, error:null }); } }; } };
      }
      if(table === 'rapporti_pt'){
        return { select(){ return this; }, or(){ return Promise.resolve({ data:[], error:null }); } };
      }
      return { select(){return this;}, eq(){return this;} };
    },
    channel(){ return { on(){ return this; }, subscribe(){ return this; } }; },
    removeChannel(){}
  };
}

test('dopoAccessoOnline: un Personal Trainer atterra direttamente sull\'area PT, non sulla home normale', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id: 'pt-1', email: 'trainer@test.it' };
    sb = (${sbFinto})({
      id:'pt-1', email:'trainer@test.it', approvato:true, bloccato:false, is_pt:true, nome:'Trainer',
      dati: Object.assign(newProfile('Trainer','trainer@test.it','x',true), {measurements:[]})
    });
    await dopoAccessoOnline();
  `);
  assert.equal(document.getElementById('areaPT').style.display, 'block',
    'l\'area PT deve essere quella visibile subito dopo il login');
  assert.equal(document.getElementById('homeScreen').style.display, 'none',
    'la home normale non deve comparire per chi è Personal Trainer');
  assert.ok(document.body.classList.contains('area-pt'));
  window.close();
});

test('dopoAccessoOnline: un utente normale (non PT) continua ad atterrare sulla home come prima', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    utenteOnline = { id: 'u1', email: 'utente@test.it' };
    sb = (${sbFinto})({
      id:'u1', email:'utente@test.it', approvato:true, bloccato:false, is_pt:false, nome:'Utente',
      dati: Object.assign(newProfile('Utente','utente@test.it','x',true), {measurements:[]})
    });
    await dopoAccessoOnline();
  `);
  assert.equal(document.getElementById('homeScreen').style.display, 'block');
  assert.equal(document.getElementById('areaPT').style.display, 'none');
  assert.ok(!document.body.classList.contains('area-pt'));
  window.close();
});
