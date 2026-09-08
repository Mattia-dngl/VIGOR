'use strict';
// Task 2b (roadmap, PIANO PRIMA confermato 07/09/2026): scriviStatoLocaleSubito()
// aveva una catch vuota — se localStorage era pieno, il salvataggio falliva
// senza che nessuno se ne accorgesse. Ora mostra un avviso persistente (non
// un toast che sparisce) e, se l'app è online, forza subito l'invio a Supabase
// invece di aspettare il debounce di programmaInvio().
//
// Per far scattare il QuotaExceededError vero di jsdom (localStorage.setItem
// non è sovrascrivibile in modo affidabile, vedi salvataggio-locale.test.js)
// il profilo porta con sé un campo enorme: così è la SINGOLA scrittura di
// scriviStatoLocaleSubito() a superare la quota, non un tentativo separato
// prima — un tentativo fallito e basta non lascia residui: la scrittura
// successiva, se piccola, va comunque a buon fine (verificato a mano).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

function profiloEnorme(){
  return `{ id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{}, big: 'x'.repeat(6*1024*1024) }`;
}

test('localStorage pieno: scriviStatoLocaleSubito() non lancia e mostra un avviso persistente', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    state.profiles = [${profiloEnorme()}]; activeProfileId = 'io';
    let lanciato = false;
    try{ scriviStatoLocaleSubito(); }catch(e){ lanciato = true; }
    return { lanciato, avvisoPresente: !!document.querySelector('.avviso-persistente') };
  `);
  assert.equal(r.lanciato, false, 'scriviStatoLocaleSubito() non deve mai lasciar propagare l\'errore');
  assert.equal(r.avvisoPresente, true, 'deve comparire l\'avviso persistente');
  window.close();
});

test('localStorage pieno e app online: forza subito inviaOnline(), senza aspettare il debounce', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    state.profiles = [${profiloEnorme()}]; activeProfileId = 'io';
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    let chiamate = 0;
    window.inviaOnline = async function(){ chiamate++; };
    scriviStatoLocaleSubito();
    return { chiamate };
  `);
  assert.equal(r.chiamate, 1, 'inviaOnline() deve partire subito, non solo dopo il debounce di programmaInvio()');
  window.close();
});

test('localStorage pieno ma app offline: NON tenta inviaOnline()', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    state.profiles = [${profiloEnorme()}]; activeProfileId = 'io';
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    let chiamate = 0;
    window.inviaOnline = async function(){ chiamate++; };
    scriviStatoLocaleSubito();
    return { chiamate };
  `);
  assert.equal(r.chiamate, 0);
  window.close();
});

test('una scrittura riuscita dopo l\'avviso lo fa sparire', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    state.profiles = [${profiloEnorme()}]; activeProfileId = 'io';
    scriviStatoLocaleSubito();
    const avvisoPrima = !!document.querySelector('.avviso-persistente');
    state.profiles[0].big = ''; // libero spazio, come farebbe la persona sul telefono
    scriviStatoLocaleSubito();
    return { avvisoPrima, avvisoDopo: !!document.querySelector('.avviso-persistente') };
  `);
  assert.equal(r.avvisoPrima, true);
  assert.equal(r.avvisoDopo, false);
  window.close();
});

test('il bottone "Chiudi" rimuove l\'avviso', async () => {
  const { window, document } = await loadApp();
  await run(window, `
    state.profiles = [${profiloEnorme()}]; activeProfileId = 'io';
    scriviStatoLocaleSubito();
  `);
  document.querySelector('.avviso-persistente-chiudi').click();
  assert.equal(document.querySelector('.avviso-persistente'), null);
  window.close();
});
