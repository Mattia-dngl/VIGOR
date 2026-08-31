'use strict';
// Test del "torna su" in Dieta/Scheda (e ovunque nell'app): schermate lunghe
// (Dieta, Scheda con i loro editor) rendevano scomodo risalire in cima a
// mano. Due soluzioni scelte insieme (discusse con l'utente prima di
// implementare):
//  1) un pulsante flottante (#backToTopBtn) che compare solo dopo un po' di
//     scorrimento e torna in cima con uno scorrimento fluido
//  2) ritoccare nel menu in basso (#navTabsGlobale) la scheda su cui si è
//     già: torna in cima invece di ricaricare la schermata da capo (stesso
//     gesto di Instagram/Twitter)
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, run } = require('./helpers/loadApp.js');

test('pulsante "torna su": compare solo oltre una soglia di scorrimento, sparisce tornando su', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const btn = document.getElementById('backToTopBtn');
    const scorri = (y) => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
      window.dispatchEvent(new window.Event('scroll'));
    };
    const primaDiScorrere = btn.classList.contains('show');
    scorri(50);
    const scorrimentoPoco = btn.classList.contains('show');
    scorri(600);
    const scorrimentoTanto = btn.classList.contains('show');
    scorri(0);
    const tornatoSu = btn.classList.contains('show');
    return { primaDiScorrere, scorrimentoPoco, scorrimentoTanto, tornatoSu };
  `);
  assert.equal(r.primaDiScorrere, false);
  assert.equal(r.scorrimentoPoco, false, 'con poco scorrimento il pulsante non deve ancora comparire');
  assert.equal(r.scorrimentoTanto, true, 'oltre la soglia il pulsante deve comparire');
  assert.equal(r.tornatoSu, false, 'tornati in cima il pulsante deve sparire di nuovo');
  window.close();
});

test('pulsante "torna su": al tocco scorre in cima con animazione fluida', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    let chiamate = [];
    window.scrollTo = (opz) => chiamate.push(opz);
    document.getElementById('backToTopBtn').click();
    return chiamate;
  `);
  assert.equal(r.length, 1);
  assert.equal(r[0].top, 0);
  assert.equal(r[0].behavior, 'smooth');
  window.close();
});

test('menu in basso: ritoccare la scheda già attiva torna in cima, non ricarica la schermata', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome(); // porta l'app in uno stato noto: Home visibile e attiva nel menu
    let chiamate = [];
    window.scrollTo = (opz) => chiamate.push(opz);
    const btnHome = document.querySelector('#navTabsGlobale button[data-go="home"]');
    const eraAttivaHome = btnHome.classList.contains('active');
    btnHome.click();
    return { eraAttivaHome, chiamate, homeAncoraVisibile: document.getElementById('homeScreen').style.display !== 'none' };
  `);
  assert.equal(r.eraAttivaHome, true);
  assert.equal(r.chiamate.length, 1, 'ritoccare la scheda già attiva deve scorrere in cima');
  assert.equal(r.chiamate[0].top, 0);
  assert.equal(r.chiamate[0].behavior, 'smooth');
  assert.equal(r.homeAncoraVisibile, true, 'la schermata non deve essere ricaricata, solo scorsa in cima');
  window.close();
});

// 31/08/2026 (quarto giro, segnalato con screenshot): passare da una
// schermata all'altra (es. da Dieta scorsa in basso a Scheda) lasciava la
// stessa posizione di scorrimento di prima — la nuova schermata sembrava
// già scorsa invece di partire dall'inizio. Richiesta esplicita: cambiare
// scheda deve sempre "atterrare" in cima. Il test qui sotto imponeva il
// comportamento opposto (nessuno scorrimento forzato) — invertito di
// proposito, non è una regressione.
test('menu in basso: toccare una scheda DIVERSA da quella attiva naviga e torna sempre in cima', async () => {
  const { window } = await loadApp();
  const r = await run(window, `
    const profilo = { id:'io', name:'Io', email:'io@test.it', logs:[], measurements:[], customExercises:{}, customFoods:{} };
    state.profiles = [profilo]; activeProfileId = 'io';
    mostraHome(); // stato noto: Home attiva, "Storico" non attiva
    let chiamate = [];
    window.scrollTo = (...args) => chiamate.push(args);
    const btnStorico = document.querySelector('#navTabsGlobale button[data-go="storico"]');
    btnStorico.click();
    return {
      chiamate,
      schedaVisibile: document.getElementById('appRoot').style.display !== 'none',
      schedaAttivaOra: btnStorico.classList.contains('active')
    };
  `);
  assert.equal(r.chiamate.length, 1, 'passando a una scheda diversa deve scattare lo scorrimento in cima');
  assert.deepEqual(r.chiamate[0], [0, 0]);
  assert.equal(r.schedaVisibile, true);
  assert.equal(r.schedaAttivaOra, true);
  window.close();
});
