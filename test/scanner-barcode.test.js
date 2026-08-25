'use strict';
// Test dello scanner di codice a barre nel Diario alimentare: cerca il
// prodotto su Open Food Facts (banca dati pubblica) e lo registra come
// alimento personalizzato (stesso meccanismo già usato per gli alimenti
// scritti a mano), pronto per essere aggiunto al diario. La fotocamera vera
// (BarcodeDetector + getUserMedia) non esiste in jsdom: qui si testano la
// lettura della risposta dell'API e il flusso "codice inserito a mano", che
// resta sempre disponibile anche sui browser senza lettura nativa.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('interpretaRispostaOpenFoodFacts: estrae nome e valori per 100g da una risposta valida', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return interpretaRispostaOpenFoodFacts({
      status: 1,
      product: {
        product_name: 'Nutella',
        nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 }
      }
    });
  `);
  assert.deepEqual(r, { nome: 'nutella', kcal: 539, p: 6.3, c: 57.5, f: 30.9 });
  window.close();
});

test('interpretaRispostaOpenFoodFacts: null se il prodotto non esiste (status 0)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `return interpretaRispostaOpenFoodFacts({ status: 0 });`);
  assert.equal(r, null);
  window.close();
});

test('interpretaRispostaOpenFoodFacts: null se manca il dato delle kcal (non utilizzabile)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    return interpretaRispostaOpenFoodFacts({
      status: 1,
      product: { product_name: 'Prodotto misterioso', nutriments: {} }
    });
  `);
  assert.equal(r, null);
  window.close();
});

test('cercaProdottoBarcode: trovato il prodotto, lo salva tra i customFoods e prepara il diario', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], mealLogs:[], customFoods:{}, customExercises:{} };
    state.profiles = [profilo]; activeProfileId = 'io';

    window.fetch = async (url) => ({
      json: async () => ({
        status: 1,
        product: { product_name: 'Nutella', nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 } }
      })
    });

    document.getElementById('barcodeScannerPanel').style.display = 'block';
    await cercaProdottoBarcode('3017620422003');
    return {
      customFood: activeProfile().customFoods['nutella'],
      alimentoScritto: document.getElementById('mealFoodInput').value,
      pannelloChiuso: document.getElementById('barcodeScannerPanel').style.display === 'none'
    };
  `);
  assert.deepEqual(r.customFood, { kcal: 539, p: 6.3, c: 57.5, f: 30.9 });
  assert.equal(r.alimentoScritto, 'nutella');
  assert.equal(r.pannelloChiuso, true, 'trovato il prodotto, il pannello dello scanner si chiude da solo');
  window.close();
});

test('cercaProdottoBarcode: prodotto non trovato, avvisa senza toccare i dati del profilo', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], mealLogs:[], customFoods:{}, customExercises:{} };
    state.profiles = [profilo]; activeProfileId = 'io';

    window.fetch = async (url) => ({ json: async () => ({ status: 0 }) });

    document.getElementById('barcodeScannerPanel').style.display = 'block';
    await cercaProdottoBarcode('0000000000000');
    return {
      customFoodsVuoto: Object.keys(activeProfile().customFoods).length === 0,
      statoTesto: document.getElementById('barcodeStatus').textContent,
      pannelloAncoraAperto: document.getElementById('barcodeScannerPanel').style.display === 'block'
    };
  `);
  assert.equal(r.customFoodsVuoto, true);
  assert.match(r.statoTesto, /non trovato/i);
  assert.equal(r.pannelloAncoraAperto, true, 'non trovato: il pannello resta aperto per riprovare col campo a mano');
  window.close();
});

test('cercaProdottoBarcode: errore di rete avvisa senza far crashare la pagina', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], mealLogs:[], customFoods:{}, customExercises:{} };
    state.profiles = [profilo]; activeProfileId = 'io';

    window.fetch = async () => { throw new Error('offline'); };

    await cercaProdottoBarcode('123');
    return document.getElementById('barcodeStatus').textContent;
  `);
  assert.match(r, /connessione/i);
  window.close();
});

test('cercaProdottoBarcode: senza codice inserito avvisa e non chiama la rete', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    let chiamate = 0;
    window.fetch = async () => { chiamate++; return { json: async () => ({status:0}) }; };
    const originale = toast;
    let messaggi = [];
    window.toast = function(msg){ messaggi.push(msg); return originale(msg); };
    await cercaProdottoBarcode('   ');
    return { chiamate, messaggi };
  `);
  assert.equal(r.chiamate, 0);
  assert.ok(r.messaggi.some(m => m.includes('codice a barre')));
  window.close();
});

test('apriScannerBarcode/chiudiScannerBarcode: aprono e chiudono il pannello e ripuliscono il campo a mano', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    document.getElementById('barcodeManualInput').value = '123456';
    apriScannerBarcode();
    const apertoConCampoVuoto = {
      visibile: document.getElementById('barcodeScannerPanel').style.display === 'block',
      campo: document.getElementById('barcodeManualInput').value
    };
    chiudiScannerBarcode();
    const chiuso = document.getElementById('barcodeScannerPanel').style.display === 'none';
    return { apertoConCampoVuoto, chiuso };
  `);
  assert.equal(r.apertoConCampoVuoto.visibile, true);
  assert.equal(r.apertoConCampoVuoto.campo, '', 'riaprendo lo scanner il vecchio codice inserito a mano non deve restare');
  assert.equal(r.chiuso, true);
  window.close();
});

test('il pulsante "Scansiona codice a barre" apre il pannello dello scanner', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    document.getElementById('scanBarcodeBtn').click();
    return document.getElementById('barcodeScannerPanel').style.display === 'block';
  `);
  assert.equal(r, true);
  window.close();
});

test('il pulsante "Cerca prodotto" usa il codice scritto a mano', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], mealLogs:[], customFoods:{}, customExercises:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    window.fetch = async () => ({
      json: async () => ({ status:1, product: { product_name:'Barretta Proteica', nutriments:{'energy-kcal_100g':380, proteins_100g:30} } })
    });
    document.getElementById('barcodeManualInput').value = '8001234567890';
    document.getElementById('barcodeManualBtn').click();
    await new Promise(res => setTimeout(res, 20)); // il fetch è async, lascio finire il microtask
    return activeProfile().customFoods['barretta proteica'];
  `);
  assert.equal(r.kcal, 380);
  assert.equal(r.p, 30);
  window.close();
});

test('senza BarcodeDetector nel browser, aprire lo scanner non prova ad accendere la fotocamera (nessun crash)', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    // jsdom non ha BarcodeDetector: verifico solo che aprire il pannello non generi errori
    // e che il video resti nascosto (nessun tentativo di avviare lo stream)
    apriScannerBarcode();
    return document.getElementById('barcodeVideo').style.display;
  `);
  assert.equal(r, 'none');
  window.close();
});
