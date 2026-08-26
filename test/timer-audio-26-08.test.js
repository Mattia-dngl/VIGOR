'use strict';
// Feedback dell'utente (26/08/2026): "il timer fa bloccare la musica al
// telefono, ma soprattutto quando apri l'app che un suono silenzioso che
// parte e anche in quel caso fa bloccare la musica, rivedi tutto il timer".
//
// Causa reale trovata: `sbloccaAudio()` (che riproduce un file audio muto di
// 0,01s per "sbloccare" l'audio su iPhone, richiesto per poter poi far
// suonare la sveglia più tardi senza un nuovo gesto) era agganciata a un
// listener GLOBALE su `document` per pointerdown/touchstart/keydown — quindi
// bastava aprire l'app e toccare un punto qualsiasi, anche senza mai
// avvicinarsi al timer, per far partire una sessione audio del telefono che
// mette in pausa la musica in riproduzione (Spotify, Musica...), pur essendo
// il suono stesso silenzioso. Fix: `sbloccaAudio()` si chiama ora SOLO da
// dentro `timerAvvia()`, cioè quando l'utente sceglie davvero di avviare un
// timer (bottone "Avvia" o una scorciatoia) — mai per il solo fatto di aprire
// l'app o toccare qualcos'altro.
//
// Nota per l'utente (non risolvibile via JS): quando il timer arriva a zero
// e suona per davvero, la musica di sottofondo viene comunque messa in pausa
// — è un limite della piattaforma (i siti web non hanno modo di dire al
// telefono "questo suono può convivere con la musica", a differenza delle
// app native). Chi non vuole MAI che il timer tocchi l'audio può disattivare
// "Suono del timer" nelle Impostazioni: resta solo la vibrazione, che non
// interferisce mai con la musica.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('aprire l\'app e toccare un punto qualsiasi (pointerdown/touchstart/keydown su document) NON sblocca più l\'audio', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    let chiamato = 0;
    window.sbloccaAudio = () => { chiamato++; };
    document.dispatchEvent(new window.Event('pointerdown'));
    document.dispatchEvent(new window.Event('touchstart'));
    document.dispatchEvent(new window.Event('keydown'));
    return chiamato;
  `);
  assert.equal(r, 0, 'nessun listener globale deve più chiamare sbloccaAudio() al solo tocco/tasto generico');
  window.close();
});

test('avviare il timer col bottone "Avvia" sblocca l\'audio (unico punto rimasto)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    let chiamato = 0;
    window.sbloccaAudio = () => { chiamato++; };
    document.getElementById('timerAvvia').click();
    return chiamato;
  `);
  assert.equal(r, 1);
  window.close();
});

test('timerAvvia(sec) chiama sempre sbloccaAudio(), qualunque sia il punto da cui viene invocata (bottone o scorciatoia)', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    let chiamato = 0;
    window.sbloccaAudio = () => { chiamato++; };
    timerAvvia(90);
    return chiamato;
  `);
  assert.equal(r, 1);
  window.close();
});

test('una scorciatoia del timer (es. 60") sblocca l\'audio, come il bottone "Avvia"', async () => {
  const { window, document } = await loadApp();
  await run(window, `renderScorciatoieTimer();`);
  const r = await run(window, `
    let chiamato = 0;
    window.sbloccaAudio = () => { chiamato++; };
    document.querySelector('#timerPresets button[data-sec="60"]').click();
    return chiamato;
  `);
  assert.equal(r, 1);
  window.close();
});

test('regressione: avviare e fermare il timer continua a funzionare come prima', async () => {
  const { window, document } = await loadApp();
  const r = await run(window, `
    document.getElementById('timerAvvia').click();
    const inCorsoDopoAvvio = _timerFine !== null;
    document.getElementById('timerAvvia').click();
    const fermoDopoSecondoTocco = _timerFine === null;
    return { inCorsoDopoAvvio, fermoDopoSecondoTocco };
  `);
  assert.equal(r.inCorsoDopoAvvio, true);
  assert.equal(r.fermoDopoSecondoTocco, true);
  window.close();
});
