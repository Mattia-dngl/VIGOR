// ============================================================
// CONSOLE DEL PROPRIETARIO — le pagine Persone e Incassi (11/09/2026).
// Punti 03 e 05 del piano; "Salute app" sta in js/admin/salute-app.js e la
// Home della console in js/admin/console-proprietario.js.
//
// Entrambe riusano .mp-overlay/.mp-modal come le altre finestre dell'app, e
// i componenti già esistenti (.card, .acct-highlight-card,
// .pt-riepilogo-stats, .seg-toggle) invece di inventarne di nuovi.
// ============================================================

// ============================================================
// PERSONE
// Chi c'è, e soprattutto da quanto non entra. Il dato dell'ultimo accesso
// viene dalla tabella "accessi", che è nata oggi: per chi non è più entrato
// da allora la pagina dice "mai visto entrare" invece di inventare una data.
// È la verità — auth.users.last_sign_in_at non è leggibile dal client e
// auth.audit_log_entries è vuota.
// ============================================================
let _personeFiltro = 'tutti';
let _personeDati = { profili: [], ultimoAccesso: {} };

function giorniDaAccesso(iso){
  if(!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function testoUltimoAccesso(iso){
  const g = giorniDaAccesso(iso);
  if(g === null) return 'mai visto entrare';
  if(g <= 0) return 'oggi';
  if(g === 1) return 'ieri';
  if(g < 30) return `${g} giorni fa`;
  return formatDate(String(iso).slice(0,10));
}

async function caricaPersone(){
  const corpo = document.getElementById('personeCorpo');
  if(!corpo) return;
  if(!sb || !sonoAmministratore()){
    corpo.innerHTML = '<div class="empty">Sezione riservata.</div>';
    return;
  }
  corpo.innerHTML = '<div class="empty">Carico gli account…</div>';

  const [rispProfili, rispAccessi] = await Promise.all([
    sb.from('profili').select('id,nome,email,is_pt,approvato,bloccato,creato_il').order('creato_il'),
    sb.from('accessi').select('profilo_id,creato_il').eq('esito','riuscito')
      .order('creato_il', { ascending:false }).limit(2000)
  ]);

  if(rispProfili.error){
    corpo.innerHTML = `<div class="empty">Non riesco a leggere gli account: ${escapeAttr(rispProfili.error.message)}</div>`;
    return;
  }

  // Le righe arrivano dalla più recente: la prima che incontro per ogni
  // profilo è già il suo ultimo accesso, non serve ordinare altro.
  const ultimo = {};
  (rispAccessi.data || []).forEach(r => {
    if(r.profilo_id && !ultimo[r.profilo_id]) ultimo[r.profilo_id] = r.creato_il;
  });

  _personeDati = { profili: rispProfili.data || [], ultimoAccesso: ultimo };
  renderPersone();
}

function renderPersone(){
  const corpo = document.getElementById('personeCorpo');
  if(!corpo) return;
  const { profili, ultimoAccesso } = _personeDati;

  const conAccesso = profili.map(p => ({
    ...p,
    ultimo: ultimoAccesso[p.id] || null,
    giorni: giorniDaAccesso(ultimoAccesso[p.id])
  }));

  const inAttesa = conAccesso.filter(p => !p.approvato);
  const pt = conAccesso.filter(p => p.is_pt);
  // "fermo" = non entra da almeno 14 giorni. Chi non è MAI stato visto
  // entrare non è fermo: semplicemente non lo sappiamo ancora, perché il
  // registro è partito oggi.
  const fermi = conAccesso.filter(p => p.giorni !== null && p.giorni >= 14);

  const elenco = _personeFiltro === 'pt' ? pt
               : _personeFiltro === 'fermi' ? fermi
               : _personeFiltro === 'attesa' ? inAttesa
               : conAccesso;

  // ordino per assenza: in fondo chi rischi di perdere
  const ordinati = [...elenco].sort((a,b) => {
    if(a.giorni === null && b.giorni === null) return (a.nome||'').localeCompare(b.nome||'');
    if(a.giorni === null) return 1;
    if(b.giorni === null) return -1;
    return a.giorni - b.giorni;
  });

  const righe = ordinati.map(p => {
    const stato = !p.approvato ? '<span class="tag-console attesa">in attesa</span>'
                : p.bloccato ? '<span class="tag-console bloccato">bloccato</span>'
                : p.is_pt ? '<span class="tag-console pt">PT</span>' : '';
    const classePunto = p.giorni === null ? 'skip' : p.giorni >= 14 ? 'warn' : 'ok';
    return `
      <div class="r-console">
        <span class="av-console">${escapeAttr(inizialiNome(p.nome))}</span>
        <div class="grow-console">
          <div class="nome-console">${escapeAttr(p.nome) || '(senza nome)'}</div>
          <div class="mail-console">${escapeAttr(p.email || '')}</div>
        </div>
        ${stato}
        <span class="meta-console meta-${classePunto}">${testoUltimoAccesso(p.ultimo)}</span>
      </div>`;
  }).join('') || '<div class="empty">Nessuno in questo gruppo.</div>';

  const maiVisti = conAccesso.filter(p => p.giorni === null).length;
  const nota = maiVisti > 0 ? `
    <p class="hint" style="margin:10px 0 0;">${maiVisti === 1 ? 'Una persona non risulta' : maiVisti + ' persone non risultano'} ancora: il registro degli accessi è partito oggi e non esiste nessuno storico precedente. Si popola da solo man mano che rientrano.</p>` : '';

  corpo.innerHTML = `
    <div class="pt-riepilogo-stats">
      <div class="pt-riepilogo-stat"><b>${conAccesso.length}</b><span>account</span></div>
      <div class="pt-riepilogo-stat"><b>${pt.length}</b><span>Personal Trainer</span></div>
      <div class="pt-riepilogo-stat"><b>${inAttesa.length}</b><span>in attesa</span></div>
    </div>
    <div class="seg-toggle" id="personeFiltri">
      <button type="button" class="seg-btn${_personeFiltro==='tutti'?' active':''}" data-f="tutti">Tutti</button>
      <button type="button" class="seg-btn${_personeFiltro==='pt'?' active':''}" data-f="pt">PT</button>
      <button type="button" class="seg-btn${_personeFiltro==='fermi'?' active':''}" data-f="fermi">Fermi</button>
      <button type="button" class="seg-btn${_personeFiltro==='attesa'?' active':''}" data-f="attesa">In attesa</button>
    </div>
    <div class="card">${righe}${nota}</div>
    <p class="hint" style="text-align:center;">Approvare, bloccare, rendere PT o eliminare un account si fa da <b>Gestione dell'app</b>: le azioni che cancellano dati stanno in un posto solo, non in due.</p>`;

  corpo.querySelectorAll('#personeFiltri .seg-btn').forEach(b => {
    b.addEventListener('click', () => { _personeFiltro = b.dataset.f; renderPersone(); });
  });
}

// ============================================================
// INCASSI
// I Personal Trainer che pagano VIGOR. La tabella abbonamenti_pt esiste e
// il webhook Stripe è deployato, ma i pagamenti non sono accesi: finché è
// così questa pagina dirà zero, e lo dirà apertamente invece di sembrare
// vuota per un errore.
// ============================================================
async function caricaIncassi(){
  const corpo = document.getElementById('incassiCorpo');
  if(!corpo) return;
  if(!sb || !sonoAmministratore()){
    corpo.innerHTML = '<div class="empty">Sezione riservata.</div>';
    return;
  }
  corpo.innerHTML = '<div class="empty">Carico gli abbonamenti…</div>';

  const [rispAbb, rispProfili] = await Promise.all([
    sb.from('abbonamenti_pt').select('pt_id,piano,stato,prova_scade_il,aggiornato_il'),
    sb.from('profili').select('id,nome,email,is_pt')
  ]);

  if(rispAbb.error){
    corpo.innerHTML = `<div class="empty">Non riesco a leggere gli abbonamenti: ${escapeAttr(rispAbb.error.message)}</div>`;
    return;
  }

  const nomi = {};
  (rispProfili.data || []).forEach(p => { nomi[p.id] = p; });
  const abbonamenti = rispAbb.data || [];
  const ptTotali = (rispProfili.data || []).filter(p => p.is_pt).length;

  const attivi = abbonamenti.filter(a => a.stato === 'attivo');
  const prova = abbonamenti.filter(a => a.stato === 'prova');
  const finiti = abbonamenti.filter(a => a.stato === 'scaduto' || a.stato === 'pagamento_fallito');

  const righe = abbonamenti.map(a => {
    const p = nomi[a.pt_id] || {};
    const giorni = a.prova_scade_il
      ? Math.ceil((new Date(a.prova_scade_il).getTime() - Date.now()) / 86400000) : null;
    const urgente = giorni !== null && giorni <= 7;
    const classe = a.stato === 'attivo' ? 'ok' : a.stato === 'prova' ? (urgente ? 'warn' : 'ok') : 'skip';
    const quando = giorni === null ? ''
      : giorni < 0 ? `scaduto da ${Math.abs(giorni)} giorni`
      : giorni === 0 ? 'scade oggi'
      : giorni === 1 ? 'scade domani' : `scade fra ${giorni} giorni`;
    return `
      <div class="r-console">
        <span class="dot-console ${classe}"></span>
        <div class="grow-console">
          <div class="nome-console">${escapeAttr(p.nome || '(profilo sconosciuto)')}</div>
          <div class="mail-console">${escapeAttr(a.piano || 'senza piano')} · ${escapeAttr(a.stato)}${quando ? ' · ' + quando : ''}</div>
        </div>
        ${urgente || a.stato === 'scaduto' ? '<button type="button" class="mini-console" data-scrivi="' + escapeAttr(a.pt_id) + '">Scrivi</button>' : ''}
      </div>`;
  }).join('');

  const vuoto = abbonamenti.length === 0 ? `
    <div class="card acct-highlight-card stato-low">
      <div class="alert-icon">${ICONA_CARTA}</div>
      <div>
        <div class="alert-title">I pagamenti non sono accesi</div>
        <p class="alert-sub">La tabella degli abbonamenti è vuota e il webhook Stripe, pur già deployato, non riceve niente. ${ptTotali === 1 ? "C'è 1 Personal Trainer" : `Ci sono ${ptTotali} Personal Trainer`} sull'app: nessuno paga, ed è corretto così finché non attivi i piani.</p>
      </div>
    </div>` : '';

  corpo.innerHTML = `
    <div class="pt-riepilogo-stats">
      <div class="pt-riepilogo-stat"><b>${attivi.length}</b><span>attivi</span></div>
      <div class="pt-riepilogo-stat"><b>${prova.length}</b><span>in prova</span></div>
      <div class="pt-riepilogo-stat"><b>${finiti.length}</b><span>scaduti</span></div>
    </div>
    ${vuoto}
    ${righe ? `<div class="card">${righe}</div>` : ''}`;

  corpo.querySelectorAll('[data-scrivi]').forEach(b => {
    b.addEventListener('click', () => {
      // Il memo non parte da solo: è un sollecito di pagamento a un cliente
      // pagante, e chi lo manda deve poterlo rileggere prima. Qui si apre la
      // schermata dei messaggi, il testo lo scrive lui.
      chiudiIncassi();
      if(typeof apriMessaggiHome === 'function') apriMessaggiHome();
      else toast("Apri Messaggi dalla Home per scrivergli.");
    });
  });
}

const ICONA_CARTA = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 14.5h3"/></svg>';

// ============================================================
// Apertura / chiusura
// ============================================================
function apriPersone(){
  const ov = document.getElementById('personeOverlay');
  if(!ov) return;
  ov.classList.add('show');
  caricaPersone();
}
function chiudiPersone(){
  document.getElementById('personeOverlay')?.classList.remove('show');
}
function apriIncassi(){
  const ov = document.getElementById('incassiOverlay');
  if(!ov) return;
  ov.classList.add('show');
  caricaIncassi();
}
function chiudiIncassi(){
  document.getElementById('incassiOverlay')?.classList.remove('show');
}

document.getElementById('personeChiudi')?.addEventListener('click', chiudiPersone);
document.getElementById('incassiChiudi')?.addEventListener('click', chiudiIncassi);
document.getElementById('personeOverlay')?.addEventListener('click', e => {
  if(e.target.id === 'personeOverlay') chiudiPersone();
});
document.getElementById('incassiOverlay')?.addEventListener('click', e => {
  if(e.target.id === 'incassiOverlay') chiudiIncassi();
});
