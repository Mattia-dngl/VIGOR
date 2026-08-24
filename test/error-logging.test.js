'use strict';
// Test del logging errori su Supabase (index.html, sezione "VISIBILITÀ ERRORI
// IN PRODUZIONE"): window.onerror / unhandledrejection devono finire come
// riga in error_logs, senza mai spammare la tabella e senza mai generare a
// loro volta un errore (o peggio, un loop infinito se l'insert stesso fallisce).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('segnalaErroreClient: non fa nulla se sb non è configurato (uso locale/offline)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    sb = null; // ramo locale: nessuna riga da nessuna parte
    let chiamato = false;
    segnalaErroreClient('errore', 'boom', 'stack finto');
    return { chiamato };
  `);
  assert.equal(r.chiamato, false);
  window.close();
});

test('segnalaErroreClient: inserisce una riga in error_logs con i campi attesi', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    rigaOnline = { id: 'utente-1' };
    let inserito = null;
    sb = { from(table){
      return { insert(riga){ inserito = {table, riga}; return Promise.resolve({error:null}); } };
    }};
    segnalaErroreClient('errore', 'Qualcosa è andato storto', 'Error: boom\\n at f (x.js:1:1)', {extra:1});
    await new Promise(res=>setTimeout(res,0));
    return inserito;
  `);
  assert.equal(r.table, 'error_logs');
  assert.equal(r.riga.tipo, 'errore');
  assert.equal(r.riga.messaggio, 'Qualcosa è andato storto');
  assert.match(r.riga.stack, /boom/);
  assert.equal(r.riga.profilo_id, 'utente-1');
  assert.deepEqual(r.riga.contesto, {extra:1});
  window.close();
});

test('segnalaErroreClient: lo stesso errore ripetuto viene inviato una sola volta', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    let inviate = 0;
    sb = { from(){ return { insert(){ inviate++; return Promise.resolve({error:null}); } }; } };
    for(let i=0;i<10;i++) segnalaErroreClient('errore', 'stesso errore sempre', 'stesso stack');
    await new Promise(res=>setTimeout(res,0));
    return { inviate };
  `);
  assert.equal(r.inviate, 1);
  window.close();
});

test('segnalaErroreClient: se il salvataggio fallisce non genera altre rejection non gestite (niente loop)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    sb = { from(){ return { insert(){ return Promise.reject(new Error('rete assente')); } }; } };
    let rejectionVista = false;
    window.addEventListener('unhandledrejection', ()=>{ rejectionVista = true; });
    segnalaErroreClient('errore', 'errore che non riesco a salvare', null);
    await new Promise(res=>setTimeout(res,20));
    return { rejectionVista };
  `);
  assert.equal(r.rejectionVista, false);
  window.close();
});

test('segnalaErroreClient: rispetta il tetto massimo di log per sessione', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    let inviate = 0;
    sb = { from(){ return { insert(){ inviate++; return Promise.resolve({error:null}); } }; } };
    for(let i=0;i<40;i++) segnalaErroreClient('errore', 'errore numero ' + i, null);
    await new Promise(res=>setTimeout(res,0));
    return { inviate, tetto: MAX_ERRORI_PER_SESSIONE };
  `);
  assert.equal(r.inviate, r.tetto);
  assert.ok(r.inviate < 40);
  window.close();
});
