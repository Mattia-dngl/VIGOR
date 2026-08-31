// ============================================================
// MAIN — avvio del prototipo: collega lo stato alle schermate e
// gestisce il pannello di test (SOLO prototipo, da rimuovere in
// integrazione: vedi README, sezione "Cosa non va integrato").
// ============================================================
window.MP = window.MP || {};

MP.main = (function () {

  const SCHERMATE = {
    switcher: { elemento: 'schermataSwitcher', modulo: MP.schermataSwitcher },
    aggiungi: { elemento: 'schermataAggiungi', modulo: MP.schermataAggiungi },
    badge: { elemento: 'schermataBadge', modulo: MP.schermataBadge },
    app: { elemento: 'schermataPlaceholder', modulo: MP.schermataPlaceholder }
  };

  function mostraSchermata(nomeAttivo) {
    Object.entries(SCHERMATE).forEach(([nome, def]) => {
      const el = document.getElementById(def.elemento);
      el.classList.toggle('attiva', nome === nomeAttivo);
    });
    const def = SCHERMATE[nomeAttivo];
    if (def) def.modulo.render();
  }

  let timerToast = null;
  function mostraToast(testo, errore) {
    const toast = document.getElementById('mpToast');
    toast.textContent = testo;
    toast.classList.toggle('mp-toast-errore', !!errore);
    toast.classList.add('visibile');
    clearTimeout(timerToast);
    timerToast = setTimeout(() => toast.classList.remove('visibile'), 2600);
  }

  // Applica la regola del punto 4: con più iscrizioni attive si
  // mostra lo switcher; con una sola si potrebbe entrare
  // direttamente. Nel prototipo si resta comunque navigabili a
  // mano per poter testare ogni schermata.
  function avviaFlusso() {
    MP.stato.vaiA('switcher');
  }

  function inizializzaPannelloTest() {
    const pannello = document.getElementById('mpDevPanel');
    const corpo = document.getElementById('mpDevBody');
    document.getElementById('mpDevToggle').addEventListener('click', () => {
      corpo.hidden = !corpo.hidden;
    });
    pannello.querySelectorAll('[data-scenario]').forEach(btn => {
      btn.addEventListener('click', () => {
        MP.dati.impostaScenario(btn.dataset.scenario);
        mostraToast('Scenario: ' + btn.textContent.trim());
        mostraSchermata(MP.stato.get().schermata);
      });
    });
  }

  function inizializza() {
    MP.schermataSwitcher.inizializza();
    MP.schermataAggiungi.inizializza();
    MP.schermataBadge.inizializza();
    MP.schermataPlaceholder.inizializza();
    inizializzaPannelloTest();

    MP.stato.osserva(s => mostraSchermata(s.schermata));
    avviaFlusso();
  }

  return { inizializza, mostraToast };
})();

document.addEventListener('DOMContentLoaded', MP.main.inizializza);
