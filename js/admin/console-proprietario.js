// ============================================================
// MODALITÀ PROPRIETARIO (11/09/2026)
//
// Sull'account che gestisce VIGOR convivevano tre mestieri diversi:
// atleta (Scheda, Registra, Dieta, Storico), Personal Trainer (area
// clienti) e proprietario (gestione dell'app). Da qui in poi quell'account
// fa solo il terzo: la parte da atleta sparisce, e la Home diventa la
// console.
//
// Come sparisce: NON cancellando dati e nemmeno togliendo elementi dal
// documento, ma con una classe sul <body> — la stessa tecnica che l'app usa
// già per 'area-pt', 'registra-aperto' e 'scheda-editor-aperto'. Tutto resta
// dov'è, e basta togliere la classe per tornare indietro. I dati di
// allenamento del profilo restano intatti nel blob: nascosti, non distrutti.
//
// L'AREA PT È IL CASO DELICATO. Non la si può far sparire e basta: finché
// esistono clienti attivi collegati a questo account, quelle persone
// resterebbero senza nessuno che può aprire la loro scheda. Quindi la card
// dell'area PT qui NON è legata alla modalità proprietario ma al dato vero:
// compare finché c'è almeno un cliente attivo, dicendo quanti sono, e
// sparisce da sola quando arrivano a zero. Così il codice è al sicuro
// qualunque sia l'ordine tra il rilascio e lo spostamento dei clienti.
// ============================================================

const FRECCIA_CONSOLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';

function modalitaProprietarioAttiva(){
  return typeof sonoAmministratore === 'function' && sonoAmministratore();
}

// Clienti attivi di cui questo account è il PT (non i PT che seguono me).
function clientiAttiviCollegati(){
  if(typeof _rapporti === 'undefined' || !Array.isArray(_rapporti)) return [];
  if(typeof utenteOnline === 'undefined' || !utenteOnline) return [];
  return _rapporti.filter(r => r.pt_id === utenteOnline.id && r.stato === 'attivo');
}

function aggiornaModalitaProprietario(){
  const attiva = modalitaProprietarioAttiva();
  document.body.classList.toggle('modalita-proprietario', attiva);
  if(attiva) renderConsoleHome();
}

// ============================================================
// La Home della console
// ============================================================
async function renderConsoleHome(){
  const box = document.getElementById('consoleHome');
  if(!box) return;

  // L'intestazione della Home è condivisa con la versione da atleta: qui il
  // saluto "Bentornato" non ha senso, questa è una postazione di lavoro.
  const saluto = document.getElementById('homeSaluto');
  if(saluto) saluto.textContent = 'Console';

  const clienti = clientiAttiviCollegati();
  const cardClienti = clienti.length > 0 ? `
    <button type="button" class="console-voce console-voce-attesa" id="consoleVersoPT">
      <div class="console-voce-testo">
        <div class="console-voce-titolo">Clienti ancora collegati</div>
        <div class="console-voce-sub">${clienti.length === 1 ? 'Una persona ha' : clienti.length + ' persone hanno'} questo account come Personal Trainer. Finché è così, l'area PT resta raggiungibile: toglierla le lascerebbe senza nessuno.</div>
      </div>
      <span class="console-voce-num">${clienti.length}</span>
    </button>` : '';

  box.innerHTML = `
    <div class="console-sez">Console</div>
    <button type="button" class="console-voce" id="consoleVerSalute">
      <div class="console-voce-testo">
        <div class="console-voce-titolo">Salute dell'app</div>
        <div class="console-voce-sub" id="consoleSaluteSub">Gli errori veri raccolti in produzione.</div>
      </div>
      <span class="console-voce-freccia">${FRECCIA_CONSOLE}</span>
    </button>
    <button type="button" class="console-voce" id="consoleVerGestione">
      <div class="console-voce-testo">
        <div class="console-voce-titolo">Gestione dell'app</div>
        <div class="console-voce-sub">Richieste in attesa, profili, Personal Trainer.</div>
      </div>
      <span class="console-voce-freccia">${FRECCIA_CONSOLE}</span>
    </button>
    ${cardClienti}
    <p class="console-nota">In arrivo: registro accessi, persone e incassi.</p>`;

  document.getElementById('consoleVerSalute')?.addEventListener('click', () => {
    if(typeof apriSaluteApp === 'function') apriSaluteApp();
  });
  document.getElementById('consoleVerGestione')?.addEventListener('click', () => {
    if(typeof apriAccountPanel === 'function') apriAccountPanel();
    const card = document.getElementById('cardAmministrazione');
    if(card){ card.open = true; card.scrollIntoView({ behavior:'smooth', block:'start' }); }
  });
  document.getElementById('consoleVersoPT')?.addEventListener('click', () => {
    if(typeof apriAreaPT === 'function') apriAreaPT();
  });

  aggiornaRiassuntoSalute();
}

// Il numero sotto "Salute dell'app": quanti errori nelle ultime 24 ore.
// È una lettura leggera e non deve poter disturbare la Home: qualunque
// problema (rete, permessi) si ferma qui e lascia il testo di partenza.
async function aggiornaRiassuntoSalute(){
  const sub = document.getElementById('consoleSaluteSub');
  if(!sub || typeof sb === 'undefined' || !sb) return;
  try{
    const da = new Date(Date.now() - 86400000).toISOString();
    const { count, error } = await sb.from('error_logs')
      .select('id', { count:'exact', head:true })
      .gte('creato_il', da);
    if(error || count === null || count === undefined) return;
    sub.textContent = count === 0
      ? 'Nessun errore nelle ultime 24 ore.'
      : count === 1 ? '1 errore nelle ultime 24 ore.' : `${count} errori nelle ultime 24 ore.`;
    sub.classList.toggle('console-voce-sub-allarme', count > 0);
  }catch(e){ console.error('riassunto salute', e); }
}
