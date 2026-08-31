'use strict';
// 31/08/2026: richiesta esplicita dell'utente (con screenshot) — "Scheda
// Attiva" era troppo in basso in Home, sotto "Obiettivo settimanale" e
// "I tuoi obiettivi": spostata subito sopra "Obiettivo settimanale".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./helpers/loadApp.js');

test('Home: "Scheda attiva" viene prima di "Obiettivo settimanale" e "I tuoi obiettivi" nel markup', async () => {
  const { window, document } = await loadApp();
  const home = document.getElementById('homeScreen');
  const schedaCard = document.getElementById('homeSchedaAttivaCard');
  const goalCard = home.querySelector('.home-goal-card');
  const obCard = home.querySelector('.home-ob-card');
  assert.ok(schedaCard && goalCard && obCard);
  // Node.DOCUMENT_POSITION_FOLLOWING: schedaCard viene prima se compareDocumentPosition
  // su goalCard/obCard restituisce FOLLOWING (4) rispetto a schedaCard.
  const posGoal = schedaCard.compareDocumentPosition(goalCard);
  const posOb = schedaCard.compareDocumentPosition(obCard);
  assert.ok(posGoal & window.Node.DOCUMENT_POSITION_FOLLOWING, '"Scheda attiva" deve venire prima di "Obiettivo settimanale"');
  assert.ok(posOb & window.Node.DOCUMENT_POSITION_FOLLOWING, '"Scheda attiva" deve venire prima di "I tuoi obiettivi"');
  window.close();
});

test('CSS: la card "I tuoi obiettivi" non lascia uno spazio vuoto extra sotto l\'ultimo form richiudibile', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.match(css, /\.home-ob-card > \.home-ob-form:last-child\{margin-bottom:2px;\}/);
});
