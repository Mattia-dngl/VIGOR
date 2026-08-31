// ============================================================
// SCHERMATA "LE TUE PALESTRE" — punto 4 della specifica.
// Mostrata dopo il login quando la persona ha più iscrizioni
// (o comunque sempre, in questo prototipo, per poterla testare).
// ============================================================
window.MP = window.MP || {};

MP.schermataSwitcher = (function () {
  const ic = MP.icone;

  function iniziale(riga) {
    return `<div class="mp-riga-logo">${riga.palestra.iniziali}</div>`;
  }

  function rigaAttiva(riga) {
    return `
      <button class="mp-riga-palestra" data-azione="entra" data-id="${riga.id}">
        ${iniziale(riga)}
        <div class="mp-riga-info">
          <div class="mp-riga-nome">${riga.palestra.nome}</div>
          <div class="mp-riga-indirizzo">${riga.palestra.indirizzo}</div>
        </div>
        <span class="mp-riga-freccia">${ic.freccia()}</span>
      </button>`;
  }

  function rigaInAttesa(riga) {
    return `
      <div class="mp-riga-palestra mp-riga-attesa" data-id="${riga.id}">
        ${iniziale(riga)}
        <div class="mp-riga-info">
          <div class="mp-riga-nome">${riga.palestra.nome}</div>
          <div class="mp-riga-tag-attesa">${ic.orologio()} In attesa di approvazione</div>
        </div>
      </div>`;
  }

  function renderElenco() {
    const attive = MP.dati.iscrizioniAttive();
    const attesa = MP.dati.iscrizioniInAttesa();
    const contenitore = document.getElementById('mpListaPalestre');
    const vuoto = document.getElementById('mpSwitcherVuoto');

    if (attive.length === 0 && attesa.length === 0) {
      contenitore.innerHTML = '';
      vuoto.hidden = false;
      return;
    }
    vuoto.hidden = true;
    contenitore.innerHTML =
      attive.map(rigaAttiva).join('') + attesa.map(rigaInAttesa).join('');
  }

  function render() {
    document.getElementById('mpNomeUtente').textContent =
      MP.dati.profiloCorrente().nome.split(' ')[0];
    renderElenco();
  }

  function collegaEventi() {
    document.getElementById('mpListaPalestre').addEventListener('click', (e) => {
      const bottone = e.target.closest('[data-azione="entra"]');
      if (!bottone) return;
      MP.stato.vaiA('badge', { palestraSelezionataId: bottone.dataset.id });
    });

    document.getElementById('mpBtnAggiungiPalestra').addEventListener('click', () => {
      MP.stato.vaiA('aggiungi');
    });

    document.getElementById('mpBtnAggiungiDaVuoto').addEventListener('click', () => {
      MP.stato.vaiA('aggiungi');
    });
  }

  function inizializza() {
    collegaEventi();
  }

  return { inizializza, render };
})();
