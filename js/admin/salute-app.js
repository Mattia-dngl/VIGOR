// ============================================================
// SALUTE APP — prima pagina della console del proprietario (11/09/2026)
//
// error_logs raccoglie da agosto i crash JS veri in produzione
// (window.onerror / unhandledrejection, vedi js/admin/gestione-utenti.js),
// ma finora era SOLA SCRITTURA: sul database esisteva una policy INSERT
// per chiunque e nessuna SELECT, quindi i log entravano e non poteva
// rileggerli nessuno. Con la policy di lettura riservata
// all'amministratore (privato.sono_admin(), la stessa già usata dalle
// policy di "profili") quei dati diventano finalmente guardabili, ed è
// tutto quello che serviva: nessuna tabella nuova.
//
// Cosa mostra, e cosa NON pretende di sapere:
// gli errori vengono raggruppati per messaggio — lo stesso crash ripetuto
// 17 volte è UNA riga, non diciassette. Di ogni gruppo si vedono quante
// volte è successo, a quante persone e quanto tempo fa l'ultima.
// Volutamente non c'è nessuna etichetta "corretto"/"mai indagato": l'app
// non sa quando è stata rilasciata una correzione né cosa hai già
// guardato, e inventarlo renderebbe la pagina bugiarda. Al suo posto c'è
// un dato che si calcola davvero — da quanto quell'errore è silenzioso —
// che porta alla stessa conclusione senza fingere di sapere il perché.
// ============================================================

// Icone: SVG veri, non emoji (in tutta l'app si usano questi).
const ICONA_SALUTE_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5"/></svg>';
const ICONA_SALUTE_ALLARME = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';

const SALUTE_GIORNI = 30;        // finestra di default
const SALUTE_MAX_RIGHE = 500;    // tetto di sicurezza sulla lettura

let _saluteOrdine = 'recenti';   // 'recenti' | 'frequenti'
let _saluteGruppi = [];
let _salutePersone = 0;         // profili distinti colpiti nel periodo
let _saluteAperto = null;        // chiave del gruppo espanso

// Un "Script error." senza stack arriva da uno script servito da un altro
// dominio (il browser non ne rivela il contenuto): non è diagnosticabile,
// e va distinto dagli errori nostri per non farci perdere tempo sopra.
function saluteSenzaStack(gruppo){
  return !gruppo.stack || gruppo.messaggio === 'Script error.';
}

function giorniDa(iso){
  if(!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
}

function saluteQuandoTesto(iso){
  const g = giorniDa(iso);
  if(g === null) return '—';
  if(g <= 0) return 'oggi';
  if(g === 1) return 'ieri';
  if(g < 30) return `${g} giorni fa`;
  return formatDate(String(iso).slice(0,10));
}

// Raggruppa per messaggio. La chiave è il messaggio grezzo: due crash con
// lo stesso testo sono lo stesso problema, anche se lo stack differisce di
// qualche riga.
function raggruppaErrori(righe){
  const mappa = new Map();
  (righe || []).forEach(r => {
    const chiave = (r.messaggio || '(senza messaggio)').trim();
    let g = mappa.get(chiave);
    if(!g){
      g = { chiave, messaggio: chiave, volte: 0, persone: new Set(),
            ultimo: null, primo: null, tipo: r.tipo || null,
            stack: null, url: null, userAgent: null };
      mappa.set(chiave, g);
    }
    g.volte++;
    if(r.profilo_id) g.persone.add(r.profilo_id);
    if(!g.ultimo || r.creato_il > g.ultimo){
      g.ultimo = r.creato_il;
      // dell'occorrenza più recente tengo i dettagli: è quella che conta
      // per capire se il problema esiste ancora e dove
      g.stack = r.stack || null;
      g.url = r.url || null;
      g.userAgent = r.user_agent || null;
      g.tipo = r.tipo || g.tipo;
    }
    if(!g.primo || r.creato_il < g.primo) g.primo = r.creato_il;
  });
  return [...mappa.values()].map(g => Object.assign(g, { persone: g.persone.size }));
}

function ordinaGruppi(gruppi){
  const copia = [...gruppi];
  if(_saluteOrdine === 'frequenti'){
    copia.sort((a,b) => b.volte - a.volte || String(b.ultimo).localeCompare(String(a.ultimo)));
  } else {
    copia.sort((a,b) => String(b.ultimo).localeCompare(String(a.ultimo)));
  }
  return copia;
}

// ============================================================
// Lettura
// ============================================================
async function caricaSaluteApp(){
  const corpo = document.getElementById('saluteCorpo');
  if(!corpo) return;
  if(!sb || !sonoAmministratore()){
    corpo.innerHTML = '<div class="empty">Sezione riservata.</div>';
    return;
  }
  corpo.innerHTML = '<div class="empty">Carico gli errori…</div>';

  const da = new Date(Date.now() - SALUTE_GIORNI * 86400000).toISOString();
  const { data, error } = await sb.from('error_logs')
    .select('id,creato_il,messaggio,stack,tipo,url,user_agent,profilo_id')
    .gte('creato_il', da)
    .order('creato_il', { ascending: false })
    .limit(SALUTE_MAX_RIGHE);

  if(error){
    // Il caso tipico è la policy di lettura assente o l'account sbagliato:
    // dirlo apertamente evita mezz'ora di caccia al fantasma.
    corpo.innerHTML = `<div class="empty">Non riesco a leggere gli errori: ${escapeAttr(error.message)}</div>`;
    return;
  }

  _saluteGruppi = raggruppaErrori(data);
  // profili distinti su TUTTE le righe: non è la somma né il massimo dei
  // gruppi, perché la stessa persona può comparire in più errori diversi
  _salutePersone = new Set((data || []).map(r => r.profilo_id).filter(Boolean)).size;
  _saluteAperto = null;
  renderSaluteApp();
}

// ============================================================
// Disegno
// ============================================================
function renderSaluteApp(){
  const corpo = document.getElementById('saluteCorpo');
  if(!corpo) return;

  const gruppi = _saluteGruppi;
  const totale = gruppi.reduce((n,g) => n + g.volte, 0);
  const recenti24h = gruppi.filter(g => giorniDa(g.ultimo) !== null && giorniDa(g.ultimo) < 1);

  if(gruppi.length === 0){
    corpo.innerHTML = `
      <div class="card acct-highlight-card stato-ok">
        <div class="alert-icon">${ICONA_SALUTE_OK}</div>
        <div><div class="alert-title">Nessun errore in ${SALUTE_GIORNI} giorni</div>
          <p class="alert-sub">Niente è arrivato su error_logs in questo periodo.</p></div>
      </div>`;
    return;
  }

  const avviso = recenti24h.length > 0
    ? `<div class="card acct-highlight-card stato-warn">
         <div class="alert-icon">${ICONA_SALUTE_ALLARME}</div>
         <div><div class="alert-title">${recenti24h.length === 1 ? 'Un errore nelle ultime 24 ore' : `${recenti24h.length} errori nelle ultime 24 ore`}</div>
           <p class="alert-sub">${escapeAttr(recenti24h[0].messaggio).slice(0,90)}</p></div>
       </div>`
    : `<div class="card acct-highlight-card stato-ok">
         <div class="alert-icon">${ICONA_SALUTE_OK}</div>
         <div><div class="alert-title">Niente di nuovo nelle ultime 24 ore</div>
           <p class="alert-sub">L'ultimo errore risale a ${saluteQuandoTesto(ordinaGruppi(gruppi)[0].ultimo)}.</p></div>
       </div>`;

  const righe = ordinaGruppi(gruppi).map(g => {
    const senzaStack = saluteSenzaStack(g);
    const g24 = giorniDa(g.ultimo);
    const classeBarra = senzaStack ? 'muto' : (g24 !== null && g24 < 7 ? 'vivo' : 'quieto');
    const aperto = _saluteAperto === g.chiave;
    const dettaglio = aperto ? `
      <div class="salute-dettaglio">
        ${g.url ? `<div class="salute-kv"><span>Pagina</span><b>${escapeAttr(g.url)}</b></div>` : ''}
        ${g.userAgent ? `<div class="salute-kv"><span>Browser</span><b>${escapeAttr(g.userAgent)}</b></div>` : ''}
        <div class="salute-kv"><span>Prima volta</span><b>${saluteQuandoTesto(g.primo)}</b></div>
        ${senzaStack
          ? `<p class="hint" style="margin:8px 0 0;">Errore senza stack: arriva da uno script di un altro dominio e il browser non dice altro. Non è diagnosticabile da qui.</p>`
          : `<pre class="salute-stack">${escapeAttr(g.stack || '(nessuno stack)')}</pre>`}
      </div>` : '';

    return `
      <div class="salute-riga${aperto ? ' aperta' : ''}" data-chiave="${escapeAttr(g.chiave)}">
        <div class="salute-riga-testa">
          <span class="salute-barra ${classeBarra}"></span>
          <div class="salute-riga-corpo">
            <div class="salute-msg">${escapeAttr(g.messaggio)}</div>
            <div class="salute-meta">
              ${g.volte} ${g.volte === 1 ? 'volta' : 'volte'} ·
              ${g.persone === 0 ? 'nessun profilo' : g.persone === 1 ? '1 persona' : `${g.persone} persone`} ·
              ${saluteQuandoTesto(g.ultimo)}
              ${senzaStack ? ' · <b>senza stack</b>' : ''}
            </div>
          </div>
        </div>
        ${dettaglio}
      </div>`;
  }).join('');

  corpo.innerHTML = `
    ${avviso}
    <div class="pt-riepilogo-stats">
      <div class="pt-riepilogo-stat"><b>${totale}</b><span>errori in ${SALUTE_GIORNI} giorni</span></div>
      <div class="pt-riepilogo-stat"><b>${gruppi.length}</b><span>tipi diversi</span></div>
      <div class="pt-riepilogo-stat"><b>${_salutePersone}</b><span>persone colpite</span></div>
    </div>
    <div class="seg-toggle" id="saluteOrdine">
      <button type="button" class="seg-btn${_saluteOrdine === 'recenti' ? ' active' : ''}" data-ordine="recenti">Più recenti</button>
      <button type="button" class="seg-btn${_saluteOrdine === 'frequenti' ? ' active' : ''}" data-ordine="frequenti">Più frequenti</button>
    </div>
    <div class="card">${righe}</div>`;

  corpo.querySelectorAll('#saluteOrdine .seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      _saluteOrdine = b.dataset.ordine;
      renderSaluteApp();
    });
  });
  corpo.querySelectorAll('.salute-riga-testa').forEach(t => {
    t.addEventListener('click', () => {
      const chiave = t.parentElement.dataset.chiave;
      _saluteAperto = (_saluteAperto === chiave) ? null : chiave;
      renderSaluteApp();
    });
  });
}

// ============================================================
// Apertura / chiusura
// ============================================================
function apriSaluteApp(){
  const ov = document.getElementById('saluteOverlay');
  if(!ov) return;
  ov.classList.add('show');
  caricaSaluteApp();
}
function chiudiSaluteApp(){
  const ov = document.getElementById('saluteOverlay');
  if(ov) ov.classList.remove('show');
}

document.getElementById('apriSaluteBtn')?.addEventListener('click', apriSaluteApp);
document.getElementById('saluteChiudi')?.addEventListener('click', chiudiSaluteApp);
document.getElementById('saluteRicarica')?.addEventListener('click', caricaSaluteApp);
document.getElementById('saluteOverlay')?.addEventListener('click', (e) => {
  if(e.target.id === 'saluteOverlay') chiudiSaluteApp();
});
