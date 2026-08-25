'use strict';
// Test dell'ottimizzazione al salvataggio locale: save() viene chiamata
// ovunque nell'app, anche a ogni singolo tasto premuto in un campo di
// Registra, e prima scriveva SEMPRE su localStorage in modo sincrono
// (JSON.stringify di tutto lo stato, tutti i profili e tutto lo storico).
// Ora le scritture ravvicinate si accorpano in una sola (come già succede
// per l'invio online), ma senza perdere l'ultima modifica se l'app va in
// background prima che il timer scada.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('save() ravvicinati: la scrittura su localStorage si accorpa in una sola, non una per chiamata', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    // localStorage.setItem è un metodo nativo (non sovrascrivibile in modo
    // affidabile su un oggetto Storage): spio invece scriviStatoLocaleSubito,
    // la funzione dell'app che fa la scrittura vera e propria.
    const originale = scriviStatoLocaleSubito;
    let conta = 0;
    window.scriviStatoLocaleSubito = function(){ conta++; return originale(); };

    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';

    // 5 modifiche ravvicinate, come 5 tasti premuti uno via l'altro
    for(let i=0; i<5; i++){ profilo.name = 'Io ' + i; save(); }
    const subitoDopo = conta;

    await new Promise(res => setTimeout(res, 550));
    const dopoAttesa = conta;
    const salvato = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return { subitoDopo, dopoAttesa, nomeSalvato: salvato.profiles[0].name };
  `);
  assert.equal(r.subitoDopo, 0, 'le 5 chiamate ravvicinate non devono scrivere subito su disco, una per una');
  assert.equal(r.dopoAttesa, 1, 'dopo l\'attesa deve essere partita esattamente una scrittura, non 5');
  assert.equal(r.nomeSalvato, 'Io 4', 'la scrittura accorpata deve comunque contenere l\'ultimo valore, non uno intermedio');
  window.close();
});

test('save() aggiorna subito lo stato in memoria: solo la scrittura su disco è rimandata, mai il dato', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Prima', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    profilo.name = 'Dopo';
    save();
    // subito dopo save(), senza aspettare nulla: chi legge state (render, backup...) vede già il valore vero
    return { nomeInMemoria: state.profiles[0].name };
  `);
  assert.equal(r.nomeInMemoria, 'Dopo');
  window.close();
});

test('se l\'app va in background prima che il timer scada, l\'ultima modifica viene scritta subito', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    const originale = scriviStatoLocaleSubito;
    let conta = 0;
    window.scriviStatoLocaleSubito = function(){ conta++; return originale(); };

    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    save(); // avvia il timer di 400ms, non ancora scaduto

    const primaDelBackground = conta;
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new window.Event('visibilitychange'));
    return { primaDelBackground, dopoBackground: conta };
  `);
  assert.equal(r.primaDelBackground, 0, 'prima di andare in background non deve ancora aver scritto (il timer non è scaduto)');
  assert.equal(r.dopoBackground, 1, 'andando in background deve scrivere subito, senza aspettare il timer');
  window.close();
});
