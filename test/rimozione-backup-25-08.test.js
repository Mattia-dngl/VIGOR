'use strict';
// Su richiesta esplicita dell'utente il 25/08/2026, l'intera funzione di
// backup/ripristino dati (.json) è stata tolta da tutta l'app: sia da
// Impostazioni ("Sicurezza dei dati": backup manuale + ripristino da file),
// sia dall'editor della Scheda ("Backup dati" / "Ripristina backup").
// NON va toccato invece l'export/import Excel dei link video degli esercizi
// di base (funzione separata, per chi amministra/fa da PT): questo test
// verifica che sia rimasto al suo posto, per non confondere le due cose.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/loadApp.js');

test('la funzione di backup/ripristino dati (.json) non esiste più da nessuna parte nell\'app', async () => {
  const { document, window } = await loadApp();
  ['backupOraBtn', 'ripristinaMioFile', 'backupDatiDetails', 'exportBtn',
   'ripristinaBackupDetails', 'importFile'].forEach(id => {
    assert.equal(document.getElementById(id), null, `#${id} non deve più esistere nel DOM`);
  });
  ['ripristinaDaCopia', 'mostraEsitoRipristino', 'giorniDaUltimoBackup', 'scaricaBackup']
    .forEach(nome => {
      assert.equal(window.eval(`typeof ${nome}`), 'undefined', `${nome}() non deve più esistere`);
    });
  window.close();
});

test('l\'export/import Excel dei link video degli esercizi (funzione separata) resta al suo posto', async () => {
  const { window, document } = await loadApp();
  assert.ok(document.getElementById('exportExVideosBtn'), 'il tasto di export dei link video non va rimosso: è una funzione diversa dal backup');
  assert.ok(document.getElementById('importExVideosInput'));
  window.close();
});
