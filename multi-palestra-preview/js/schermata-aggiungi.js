// ============================================================
// SCHERMATA "AGGIUNGI PALESTRA" — punto 3 della specifica.
// Due percorsi equivalenti (codice / elenco), stesso risultato:
// una iscrizione con stato = in_attesa. Nessuna accettazione
// automatica, nemmeno con codice valido.
// ============================================================
window.MP = window.MP || {};

MP.schermataAggiungi = (function () {
  const ic = MP.icone;

  function rigaElenco(p) {
    const richiesta = MP.dati.elencoIscrizioni().some(
      i => i.palestra.id === p.id && i.stato !== 'rimossa'
    );
    return `
      <div class="mp-riga-palestra mp-riga-elenco">
        <div class="mp-riga-logo">${p.iniziali}</div>
        <div class="mp-riga-info">
          <div class="mp-riga-nome">${p.nome}</div>
          <div class="mp-riga-indirizzo">${p.indirizzo}</div>
        </div>
        <button class="mp-btn-piccolo" data-azione="richiedi" data-id="${p.id}" ${richiesta ? 'disabled' : ''}>
          ${richiesta ? 'Richiesta inviata' : 'Richiedi'}
        </button>
      </div>`;
  }

  function renderElenco(filtro) {
    const testo = (filtro || '').trim().toLowerCase();
    const elenco = MP.dati.palestreDisponibili().filter(p =>
      !testo || p.nome.toLowerCase().includes(testo) || p.indirizzo.toLowerCase().includes(testo)
    );
    document.getElementById('mpElencoPalestre').innerHTML =
      elenco.length ? elenco.map(rigaElenco).join('')
        : `<p class="mp-hint">Nessuna palestra trovata.</p>`;
  }

  function mostraTab(nome) {
    document.querySelectorAll('.mp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === nome));
    document.getElementById('mpPannelloCodice').hidden = nome !== 'codice';
    document.getElementById('mpPannelloElenco').hidden = nome !== 'elenco';
    if (nome === 'elenco') renderElenco(document.getElementById('mpInputRicerca').value);
  }

  function esitoRichiesta(esito) {
    if (esito.ok) {
      MP.main.mostraToast('Richiesta inviata: attendi la conferma della palestra.');
      MP.stato.vaiA('switcher');
    } else if (esito.motivo === 'codice_non_valido') {
      MP.main.mostraToast('Codice non valido. Controlla e riprova.', true);
    } else if (esito.motivo === 'gia_richiesta') {
      MP.main.mostraToast('Hai già una richiesta o un\'iscrizione per questa palestra.', true);
    }
  }

  function collegaEventi() {
    document.getElementById('mpBtnIndietroAggiungi').addEventListener('click', () => {
      MP.stato.vaiA('switcher');
    });

    document.querySelectorAll('.mp-tab').forEach(t => {
      t.addEventListener('click', () => mostraTab(t.dataset.tab));
    });

    document.getElementById('mpBtnInviaCodice').addEventListener('click', () => {
      const input = document.getElementById('mpInputCodice');
      const esito = MP.dati.richiediPerCodice(input.value);
      if (esito.ok) input.value = '';
      esitoRichiesta(esito);
    });

    document.getElementById('mpInputRicerca').addEventListener('input', (e) => {
      renderElenco(e.target.value);
    });

    document.getElementById('mpElencoPalestre').addEventListener('click', (e) => {
      const bottone = e.target.closest('[data-azione="richiedi"]');
      if (!bottone) return;
      const esito = MP.dati.richiediIscrizione(bottone.dataset.id);
      esitoRichiesta(esito);
    });
  }

  function render() {
    document.getElementById('mpInputCodice').value = '';
    document.getElementById('mpInputRicerca').value = '';
    mostraTab('codice');
  }

  function inizializza() {
    collegaEventi();
  }

  return { inizializza, render };
})();
