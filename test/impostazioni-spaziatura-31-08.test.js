'use strict';
// 31/08/2026: segnalato che il primo elemento di una sezione aperta in
// Impostazioni (es. "Promemoria allenamento") restava incollato al bordo
// superiore, senza spazio né separazione dal titolo — .details-body aveva
// padding-top:0 e nessun bordo. Aggiunti entrambi (vedi css/style.css,
// details.details-card[open] > summary / .details-body).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('CSS: il corpo di una sezione .details-card aperta ha spazio sopra il primo elemento (non più incollato al bordo)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.match(css, /details\.details-card \.details-body\{padding:12px 13px 13px;\}/,
    'il padding-top deve essere maggiore di 0');
  assert.match(css, /#settingsPanel details\.details-card \.details-body, #accountPanel details\.details-card \.details-body\{padding:12px 13px 11px;\}/);
});

test('CSS: una sezione .details-card aperta ha una riga di separazione sotto il titolo, come le altre sezioni di Account', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.match(css, /details\.details-card\[open\] > summary\{border-bottom:1px solid var\(--border\);\}/);
});

// 31/08/2026: il testo introduttivo "Qui puoi aggiungere i tuoi esercizi
// personali..." (classe .sub, #exSectionsIntro) sembrava sovradimensionato
// rispetto agli altri testi esplicativi (.hint) — in realtà non aveva NESSUNA
// regola CSS generica (esistevano solo #profileGate .sub e header.top .sub),
// quindi veniva mostrato a dimensione/colore di default del browser. Aggiunta
// una regola generica .sub coerente con .hint.
test('CSS: la classe .sub ha una regola generica (testo piccolo e attenuato, non più a dimensione di default)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  assert.match(css, /\.sub\{color:var\(--text-dim\); ?font-size:12\.5px; ?line-height:1\.45;\}/);
});
