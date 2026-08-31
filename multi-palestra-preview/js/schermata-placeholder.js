// ============================================================
// SCHERMATA PLACEHOLDER "APP DELLA PALESTRA" — NON fa parte della
// specifica: serve solo a chiudere il flusso di navigazione del
// prototipo dopo lo switcher/badge, così si può testare l'intero
// percorso. A integrazione avvenuta va rimossa: al suo posto ci
// sarà la home vera e propria dell'app, già esistente in index.html.
// ============================================================
window.MP = window.MP || {};

MP.schermataPlaceholder = (function () {
  function trovaRiga() {
    const id = MP.stato.get().palestraSelezionataId;
    return MP.dati.elencoIscrizioni().find(i => i.id === id) || MP.dati.iscrizioniAttive()[0];
  }

  function render() {
    const riga = trovaRiga();
    document.getElementById('mpPlaceholderPalestra').textContent =
      riga ? riga.palestra.nome : 'questa palestra';
  }

  function collegaEventi() {
    document.getElementById('mpBtnIndietroPlaceholder').addEventListener('click', () => {
      MP.stato.vaiA('switcher');
    });
  }

  function inizializza() {
    collegaEventi();
  }

  return { inizializza, render };
})();
