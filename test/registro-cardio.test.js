'use strict';
// Richiesta esplicita dell'utente (proposte di miglioramento, 01/09/2026):
// registro "Corsa/Cardio" senza collegamento hardware. Il tipo di misura
// "distanza" (km + minuti) esisteva già nel modello dati (js/core/costanti.js,
// TIPI_MISURA/campiDi) — mancavano solo esercizi cardio pronti in libreria
// (prima andavano scritti a mano) e il calcolo del passo (min/km).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('la libreria base contiene esercizi cardio pronti (Corsa, Bici/Cyclette, Nuoto...)', async () => {
  const { window } = await loadApp();
  const nomi = await run(window, `return EX_LIB.filter(e=>e.tipo==='distanza').map(e=>e.n);`);
  ['Corsa', 'Bici / Cyclette', 'Nuoto', 'Vogatore', 'Camminata veloce', 'Ellittica', 'Salto della corda'].forEach(nome=>{
    assert.ok(nomi.includes(nome), `manca "${nome}" in libreria`);
  });
  // ogni nome deve comparire una volta sola: due voci con lo stesso nome
  // farebbero "vincere" sempre la prima trovata da libFind(), rendendo
  // l'altra morta (mai raggiungibile).
  const conteggio = {};
  nomi.forEach(n=>{ conteggio[n] = (conteggio[n]||0)+1; });
  Object.entries(conteggio).forEach(([n,c])=> assert.equal(c, 1, `"${n}" compare ${c} volte in libreria`));
});

test('scegliendo "Corsa" i campi della serie sono km+minuti, non ripetizioni x kg', async () => {
  const { window } = await loadApp();
  const campi = await run(window, `return campiDi('Corsa').map(c=>c.chiave);`);
  assert.deepEqual(campi, ['km', 'minuti']);
});

test('formatPasso: converte i minuti/km in formato min:sec', async () => {
  const { window } = await loadApp();
  const r = await run(window, `return { a: formatPasso(6), b: formatPasso(6.5), c: formatPasso(5.25), d: formatPasso(0) };`);
  assert.equal(r.a, '6:00');
  assert.equal(r.b, '6:30');
  assert.equal(r.c, '5:15');
  assert.equal(r.d, '', 'senza passo valido non deve restituire un numero senza senso');
});

test('descriviSerie mostra distanza, minuti e passo insieme per un allenamento di corsa', async () => {
  const { window } = await loadApp();
  const r = await run(window, `return descriviSerie([{km:5, minuti:30, tappa:0}], 'Corsa');`);
  assert.match(r, /5 km/);
  assert.match(r, /30'/);
  assert.match(r, /6:00 \/km/);
});

test('descriviSerie non mostra un passo se manca la distanza o i minuti', async () => {
  const { window } = await loadApp();
  const soloKm = await run(window, `return descriviSerie([{km:5, tappa:0}], 'Corsa');`);
  assert.ok(!soloKm.includes('/km'));
  const soloMin = await run(window, `return descriviSerie([{minuti:20, tappa:0}], 'Corsa');`);
  assert.ok(!soloMin.includes('/km'));
});
