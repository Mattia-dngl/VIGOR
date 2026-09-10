'use strict';
// 10/09/2026: segnalato dall'utente che il tasto "Registrati ora"/"Provalo
// gratis" della landing non funzionava: portava sempre alla schermata di
// login (index.html?app=1, lo stesso indirizzo del tasto "Accedi"), mai a
// quella di registrazione, costringendo chi non aveva un account a cercarsi
// da solo il link "Non hai un account? Registrati". I tasti della landing
// ora aggiungono &gate=registra all'indirizzo, e avvioOnline() (js/account/account.js)
// apre subito la schermata di registrazione quando non c'è nessuna sessione
// e questo parametro è presente — senza toccare il caso "Accedi" (nessun
// gate, o sessione già valida).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function sbSenzaSessione(){
  return `
    iniziaSupabase = function(){
      sb = { auth: { getSession(){ return Promise.resolve({ data:{ session:null } }); } } };
      return true;
    };
  `;
}

test('avvioOnline: con ?gate=registra e nessuna sessione, apre direttamente "Registrati" (non "Accedi")', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    history.replaceState(null, '', '/?app=1&gate=registra');
    ${sbSenzaSessione()}
    await avvioOnline();
  `);
  assert.equal(document.getElementById('cloudRegistra').style.display, 'block',
    'con gate=registra deve aprirsi subito la schermata di registrazione');
  assert.equal(document.getElementById('cloudAccedi').style.display, 'none');
  window.close();
});

test('avvioOnline: senza ?gate (tasto "Accedi"), il comportamento resta quello di sempre: si apre "Accedi"', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    history.replaceState(null, '', '/?app=1');
    ${sbSenzaSessione()}
    await avvioOnline();
  `);
  assert.equal(document.getElementById('cloudAccedi').style.display, 'block');
  assert.equal(document.getElementById('cloudRegistra').style.display, 'none');
  window.close();
});
