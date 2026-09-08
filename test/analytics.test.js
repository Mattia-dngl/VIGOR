'use strict';
// Task 6b (roadmap, 07/09/2026): analytics cookieless (Plausible/Umami),
// disattivato finché non si sceglie un provider in ANALYTICS_CONFIG — così
// resta a costo zero (nessuno script esterno, nessuna richiesta di rete)
// finché non lo si attiva davvero. Zero dati personali negli eventi.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('eventoAnalytics: senza provider configurato, non fa nulla (nessuna chiamata, nessun errore)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    let chiamato = false;
    window.plausible = () => { chiamato = true; };
    eventoAnalytics('registrazione');
    return chiamato;
  `);
  assert.equal(r, false, 'senza provider scelto, plausible() non deve mai essere chiamata');
});

test('eventoAnalytics con provider "plausible": chiama window.plausible(nome)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    window.ANALYTICS_CONFIG.provider = 'plausible';
    let ricevuto = null;
    window.plausible = (nome) => { ricevuto = nome; };
    eventoAnalytics('primo_allenamento');
    return ricevuto;
  `);
  assert.equal(r, 'primo_allenamento');
});

test('eventoAnalytics con provider "umami": chiama window.umami.track(nome, props)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    window.ANALYTICS_CONFIG.provider = 'umami';
    let ricevuto = null;
    window.umami = { track: (nome, props) => { ricevuto = { nome, props }; } };
    eventoAnalytics('ritorno_7gg', { piano: 'pt' });
    return ricevuto;
  `);
  assert.deepEqual(r, { nome: 'ritorno_7gg', props: { piano: 'pt' } });
});

test('non caricare nessuno script esterno finché non è configurato un provider (di default provider è null)', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `return window.ANALYTICS_CONFIG.provider;`);
  assert.equal(r, null);
  const scriptEsterni = Array.from(document.querySelectorAll('script[src^="http"]'))
    .filter(s => /plausible|umami/i.test(s.src));
  assert.equal(scriptEsterni.length, 0);
  window.close();
});

test('segnaEVerificaRitorno: prima visita in assoluto, nessun evento di ritorno', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    localStorage.removeItem('vigorAnalyticsUltimaVisita');
    window.ANALYTICS_CONFIG.provider = 'plausible';
    let eventi = [];
    window.plausible = (nome) => eventi.push(nome);
    segnaEVerificaRitorno();
    return eventi;
  `);
  assert.deepEqual(r, []);
});

test('segnaEVerificaRitorno: torna dopo 10 giorni → ritorno_7gg', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const diecGiorniFa = new Date(Date.now() - 10*86400000).toISOString();
    localStorage.setItem('vigorAnalyticsUltimaVisita', diecGiorniFa);
    window.ANALYTICS_CONFIG.provider = 'plausible';
    let eventi = [];
    window.plausible = (nome) => eventi.push(nome);
    segnaEVerificaRitorno();
    return eventi;
  `);
  assert.deepEqual(r, ['ritorno_7gg']);
});

test('segnaEVerificaRitorno: torna dopo 40 giorni → ritorno_30gg (non anche ritorno_7gg)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const quarantaGiorniFa = new Date(Date.now() - 40*86400000).toISOString();
    localStorage.setItem('vigorAnalyticsUltimaVisita', quarantaGiorniFa);
    window.ANALYTICS_CONFIG.provider = 'plausible';
    let eventi = [];
    window.plausible = (nome) => eventi.push(nome);
    segnaEVerificaRitorno();
    return eventi;
  `);
  assert.deepEqual(r, ['ritorno_30gg']);
});

test('segnaEVerificaRitorno: torna dopo 2 giorni, nessun evento (troppo presto)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const dueGiorniFa = new Date(Date.now() - 2*86400000).toISOString();
    localStorage.setItem('vigorAnalyticsUltimaVisita', dueGiorniFa);
    window.ANALYTICS_CONFIG.provider = 'plausible';
    let eventi = [];
    window.plausible = (nome) => eventi.push(nome);
    segnaEVerificaRitorno();
    return eventi;
  `);
  assert.deepEqual(r, []);
});
