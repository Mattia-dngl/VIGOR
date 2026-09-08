'use strict';
// Barra di navigazione dedicata alla zona Personal Trainer (mockup fornito
// dall'utente l'08/09/2026): sotto l'elenco atleti, #navTabsPT con tre tasti
// — Atleti/Messaggi/Account — che restano dentro l'area PT invece di
// riportare sempre alla Home del cliente come faceva "← Home".
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

async function entraNellAreaPT(window){
  await run(window, `
    utenteOnline = { id: 'pt-1', email: 'trainer@test.it' };
    sb = (${sbFinto})({
      id:'pt-1', email:'trainer@test.it', approvato:true, bloccato:false, is_pt:true, nome:'Trainer',
      dati: Object.assign(newProfile('Trainer','trainer@test.it','x',true), {measurements:[]})
    });
    await dopoAccessoOnline();
  `);
}

test('#navTabsPT: tre tasti Atleti/Messaggi/Account, "Atleti" attivo di default', async () => {
  const { window, document } = await loadApp();
  await entraNellAreaPT(window);
  const nav = document.getElementById('navTabsPT');
  assert.ok(nav, 'la nav dedicata alla zona PT deve esistere');
  assert.equal(nav.querySelectorAll('button').length, 3);
  assert.ok(document.getElementById('ptNavAtletiBtn').classList.contains('active'));
  window.close();
});

test('tasto "Atleti": se il dettaglio di un cliente è aperto, torna all\'elenco', async () => {
  const { window, document } = await loadApp();
  await entraNellAreaPT(window);
  document.getElementById('ptElenco').style.display = 'none';
  document.getElementById('ptDettaglio').style.display = 'block';

  document.getElementById('ptNavAtletiBtn').click();
  await new Promise(r => setTimeout(r, 0));

  assert.equal(document.getElementById('ptDettaglio').style.display, 'none');
  assert.equal(document.getElementById('ptElenco').style.display, 'block');
  window.close();
});

test('tasto "Messaggi": apre l\'overlay chat sopra l\'area PT, senza nasconderla', async () => {
  const { window, document } = await loadApp();
  await entraNellAreaPT(window);

  document.getElementById('ptNavMessaggiBtn').click();

  assert.ok(document.getElementById('messaggiHomeOverlay').classList.contains('show'));
  assert.equal(document.getElementById('areaPT').style.display, 'block',
    'l\'area PT deve restare visibile sotto l\'overlay dei messaggi');
  window.close();
});

test('tasto "Account": apre Account nascondendo l\'area PT, e chiudendolo si torna all\'area PT (non alla Home)', async () => {
  const { window, document } = await loadApp();
  await entraNellAreaPT(window);

  document.getElementById('ptNavAccountBtn').click();
  assert.equal(document.getElementById('accountPanel').style.display, 'block');
  assert.equal(document.getElementById('areaPT').style.display, 'none');

  document.getElementById('closeAccountBtn').click();
  assert.equal(document.getElementById('accountPanel').style.display, 'none');
  assert.equal(document.getElementById('areaPT').style.display, 'block',
    'chiudendo Account aperto dalla zona PT si deve tornare lì, non alla Home del cliente');
  assert.equal(document.getElementById('homeScreen').style.display, 'none');
  assert.ok(document.body.classList.contains('area-pt'));
  window.close();
});

test('Account aperto dalla Home del cliente continua a tornare alla Home come prima (comportamento invariato)', async () => {
  const { window, document } = await loadApp();
  await run(window, `apriAccountPanel();`);
  assert.equal(document.getElementById('accountPanel').style.display, 'block');

  document.getElementById('closeAccountBtn').click();
  assert.equal(document.getElementById('accountPanel').style.display, 'none');
  assert.equal(document.getElementById('homeScreen').style.display, 'block');
  assert.equal(document.getElementById('areaPT').style.display, 'none');
  window.close();
});
