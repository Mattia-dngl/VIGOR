// ============================================================
// SCHERMATA "BADGE" — punto 7 della specifica, stile di
// riferimento HeyConad (riferimento-1-heyconad.jpg, non incluso
// in questo repository: vedi README per come procurarselo).
// Dopo aver scelto la palestra dallo switcher, transizione con
// una tessera che si può far scorrere verso l'alto, oppure
// "Continua" per entrare direttamente nell'app della palestra.
// ============================================================
window.MP = window.MP || {};

MP.schermataBadge = (function () {
  const ic = MP.icone;
  let espansa = false;
  let trascinamento = null;

  function imposta(riga) {
    document.getElementById('mpBadgeLogoPalestra').textContent = riga.palestra.nome;
    document.getElementById('mpTesseraPalestra').textContent = riga.palestra.nome;
    document.getElementById('mpTesseraNome').textContent = MP.dati.profiloCorrente().nome;
    document.getElementById('mpTesseraBarcode').innerHTML = ic.codiceABarre(riga.id);
  }

  function trovaRiga() {
    const id = MP.stato.get().palestraSelezionataId;
    return MP.dati.elencoIscrizioni().find(i => i.id === id) || MP.dati.iscrizioniAttive()[0];
  }

  function setEspansa(valore) {
    espansa = valore;
    document.getElementById('mpBadgeAlza').classList.toggle('espansa', espansa);
  }

  function collegaTrascinamento() {
    const maniglia = document.getElementById('mpBadgeAlza');

    maniglia.addEventListener('click', (e) => {
      // Evita che il click generato al termine di un trascinamento
      // faccia scattare anche il toggle.
      if (trascinamento && trascinamento.mosso) return;
      setEspansa(!espansa);
    });

    maniglia.addEventListener('pointerdown', (e) => {
      // Il pulsante "Continua" è dentro l'area trascinabile: se la presa
      // arriva da lì, non catturare il puntatore, altrimenti il click
      // sul pulsante non arriverebbe mai a destinazione.
      if (e.target.closest('#mpBtnContinua')) return;
      trascinamento = { yIniziale: e.clientY, mosso: false };
      maniglia.setPointerCapture(e.pointerId);
    });

    maniglia.addEventListener('pointermove', (e) => {
      if (!trascinamento) return;
      const delta = e.clientY - trascinamento.yIniziale;
      if (Math.abs(delta) > 6) trascinamento.mosso = true;
      if (delta < -12 && !espansa) setEspansa(true);
      if (delta > 12 && espansa) setEspansa(false);
    });

    maniglia.addEventListener('pointerup', () => { trascinamento = null; });
    maniglia.addEventListener('pointercancel', () => { trascinamento = null; });
  }

  function collegaEventi() {
    document.getElementById('mpBtnIndietroBadge').addEventListener('click', () => {
      setEspansa(false);
      MP.stato.vaiA('switcher');
    });
    document.getElementById('mpBtnContinua').addEventListener('click', () => {
      setEspansa(false);
      MP.stato.vaiA('app');
    });
    collegaTrascinamento();
  }

  function render() {
    const riga = trovaRiga();
    if (riga) imposta(riga);
    setEspansa(false);
  }

  function inizializza() {
    collegaEventi();
  }

  return { inizializza, render };
})();
