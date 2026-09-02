// REGISTRA
// ============================================================
const logDateInput = document.getElementById('logDate');
logDateInput.addEventListener('change', ()=>{ renderDayChoices(); renderHeader(); });
// Tendina "che giorno hai fatto?" (31/08/2026): il <select> resta lo stesso
// nodo tra un renderDayChoices() e l'altro (si ricostruiscono solo le
// <option>), quindi l'ascoltatore va registrato una volta sola qui, non ad
// ogni render.
document.getElementById('dayChoiceChips').addEventListener('change', (e)=>{ if(e.target.value) selectDay(e.target.value); });

// Cronometro allenamento (31/08/2026): legge _logIniziatoAlle ad ogni tick e
// mostra/nasconde la card di conseguenza, quindi qualunque punto del codice
// che cambia _logIniziatoAlle (selectDay, save, pulisciBozza,
// ripristinaBozza...) viene riflesso entro un secondo senza dover chiamare
// nulla in più — BASTA però chiamare aggiornaCronometroAllenamento() una
// volta quando _logIniziatoAlle diventa vera per far partire il primo tick.
//
// L'interval NON è più globale/sempre acceso (lo era in una prima versione):
// gira solo mentre c'è davvero un allenamento in corso e si ferma da solo
// (clearInterval) non appena _logIniziatoAlle torna null — sia per non far
// lavorare inutilmente il browser quando non serve, sia perché un interval
// sempre attivo, avviato al solo caricamento della pagina, teneva viva per
// sempre la finestra jsdom nei test: un test che uscisse con un'eccezione
// prima del proprio window.close() (una asserzione fallita, non solo qui,
// in QUALUNQUE file di test) restava appeso per sempre invece di fallire e
// basta, bloccando l'intera suite (node --test non termina finché restano
// timer attivi).
let _cronometroInterval = null;
function formatDurataCronometro(sec){
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  const mm = String(m).padStart(2,'0'), ss = String(s).padStart(2,'0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
function aggiornaCronometroAllenamento(){
  const card = document.getElementById('workoutTimerCard');
  const disp = document.getElementById('workoutTimerDisplay');
  const ringFill = document.getElementById('workoutTimerRingFill');
  if(!card || !disp || !ringFill) return;
  if(!_logIniziatoAlle){
    card.style.display = 'none';
    if(_cronometroInterval){ clearInterval(_cronometroInterval); _cronometroInterval = null; }
    return;
  }
  card.style.display = 'block';
  if(!_cronometroInterval) _cronometroInterval = setInterval(aggiornaCronometroAllenamento, 1000);
  const secTrascorsi = Math.max(0, Math.floor((Date.now() - new Date(_logIniziatoAlle).getTime())/1000));
  disp.textContent = formatDurataCronometro(secTrascorsi);
  const pct = Math.min(secTrascorsi/3600*100, 100);
  const c = 2*Math.PI*46;
  ringFill.style.strokeDasharray = String(c);
  ringFill.style.strokeDashoffset = String(c*(1-pct/100));
  aggiornaBadgeATempo();
}

// Piccola spia read-only nella card del cronometro: la scelta si fa nel
// popup (mostraPopupAllenamentoATempo), qui c'è solo da mostrarla o no.
function aggiornaBadgeATempo(){
  const badge = document.getElementById('atempoBadge');
  if(badge) badge.style.display = _allenamentoATempo ? 'inline-flex' : 'none';
}
// Popup "Prima di iniziare" (01/09/2026, ricalca il mockup approvato
// dall'utente): si apre alla scelta di un giorno vero di scheda, chiede una
// sola volta se attivare il recupero cronometrato tra le serie — confermando
// con "Inizia allenamento" la scelta si blocca per tutta la sessione, niente
// tasto per chiuderla senza scegliere. Non per "Allenamento libero" (non ha
// una lista fissa di esercizi finché non ne scegli almeno uno): lì compare
// solo se, cambiando idea, si sceglie comunque un giorno vero della scheda
// dalla tendina "Che giorno hai fatto?".
//
// Deve comparire quando si ENTRA DAVVERO in Registra, non prima: renderAll()
// chiama renderDayChoices() già al login (per il promemoria in Home) e quello
// sceglie da solo il giorno di oggi se previsto — senza questo controllo il
// popup spunterebbe sopra la Home, prima ancora di aver aperto Registra.
// aggiornaPopupATempoInSospeso() (richiamata dal tab "log", vedi tabs-header.js)
// lo mostra appena la schermata diventa davvero quella giusta.
let _popupATempoInSospeso = false;
function registraEVisibileOra(){
  // #view-log parte "active" già nell'HTML grezzo (è la sotto-scheda di
  // default dentro #appRoot quando lo si apre), quindi da sola non basta:
  // #appRoot resta display:none finché non si esce davvero da Home/Account
  // (vedi showAppRoot()) — serve entrambe vere per dire "l'utente sta
  // guardando Registra adesso", non solo "se aprissi Scheda, sarebbe questa
  // la sotto-scheda".
  const appRoot = document.getElementById('appRoot');
  const viewLog = document.getElementById('view-log');
  return !!appRoot && appRoot.style.display !== 'none' && !!viewLog && viewLog.classList.contains('active');
}
function mostraPopupAllenamentoATempo(day){
  if(day.key === 'LIBERO' || _allenamentoATempoBloccato) return;
  if(!registraEVisibileOra()){
    _popupATempoInSospeso = true;
    return;
  }
  const overlay = document.getElementById('atempoOverlay');
  if(!overlay) return;
  document.getElementById('atempoSub').textContent =
    `${day.key} · ${day.name} · ${day.exercises.length} esercizi`;
  document.getElementById('atempoSwitchChk').checked = _allenamentoATempo;
  overlay.classList.add('show');
}
function aggiornaPopupATempoInSospeso(){
  if(!_popupATempoInSospeso) return;
  _popupATempoInSospeso = false;
  if(!selectedDayKey || selectedDayKey==='SKIP' || selectedDayKey==='LIBERO') return;
  const p = activeProgram();
  const day = p && p.days.find(d=>d.key===selectedDayKey);
  if(day) mostraPopupAllenamentoATempo(day);
}
document.getElementById('atempoIniziaBtn').addEventListener('click', ()=>{
  _allenamentoATempo = document.getElementById('atempoSwitchChk').checked;
  _allenamentoATempoBloccato = true;
  document.getElementById('atempoOverlay').classList.remove('show');
  aggiornaBadgeATempo();
  salvaBozza();
});
// Fa partire il timer di recupero già esistente (timerAvvia(), lo stesso del
// bottone "Avvia" manuale) con i secondi impostati sull'esercizio in scheda —
// solo se l'allenamento è "a tempo", l'esercizio ha un recupero impostato, e
// non è la prima metà di un superset (lì non c'è pausa: si passa subito al
// partner, vedi supersetEditorHtml).
function avviaRecuperoSeATtempo(exName){
  if(!_allenamentoATempo) return;
  const ex = _exerciseByName[exName];
  if(!ex || ex.supersetCon!=null || !ex.recupero) return;
  timerAvvia(ex.recupero);
  document.getElementById('timerApri').classList.remove('show');
  document.getElementById('timerBar').classList.add('show');
}

// "Allenamento a tempo" (01/09/2026, richiesta esplicita): scelta fatta una
// volta sola nel popup "Prima di iniziare" (mostraPopupAllenamentoATempo) —
// se acceso, segnare una serie come fatta (vedi .set-fatta-btn in addSetRow)
// fa partire da solo il timer di recupero (timerAvvia(), già usato a mano da
// sempre) con i secondi di ex.recupero della scheda, invece di lasciare quel
// campo puramente decorativo. _allenamentoATempoBloccato diventa vera appena
// il popup viene confermato e resta così per tutta la sessione: niente modo
// di tornare indietro, così non si mescolano riposi cronometrati e non in
// uno stesso allenamento. Persistito nella bozza come _logIniziatoAlle.
let _allenamentoATempo = false;
let _allenamentoATempoBloccato = false;
let _exerciseByName = {};   // nome esercizio -> oggetto scheda del giorno in corso, per leggere ex.recupero/ex.supersetCon dal tasto "fatta"
let _riscaldamentoNascosto = false;   // "Salta" preme una volta, resta nascosto per il resto di questo allenamento

let selectedDayKey = null;
// Durata dell'allenamento (Storico, 15° giro): quando scegli un giorno vero (non
// "Saltato") parte un cronometro in background. Persistito dentro bozzaLog
// (vedi salvaBozza/ripristinaBozza) così sopravvive a un cambio schermata o
// a un riavvio dell'app prima di salvare. Gli allenamenti registrati PRIMA di
// questa modifica non hanno mai avuto un cronometro: per quelli log.durataMinuti
// resta assente, non viene stimato/inventato.
let _logIniziatoAlle = null;
let currentSetInputs = {};
let _dropsetPerEsercizio = {};   // nome esercizio -> { drops:[...] }, solo per la sessione di registrazione in corso

function renderReminderBanner(){
  const prof = activeProfile();
  const p = activeProgram();
  const banner = document.getElementById('reminderBanner');
  const todayIso = new Date().toISOString().slice(0,10);
  const wd = WEEKDAYS[new Date().getDay()];
  const scheduled = p.days.find(d=>d.weekday===wd);
  if(!scheduled){ banner.style.display='none'; return; }
  const log = prof.logs.find(l=>l.date===todayIso && l.programId===p.id);
  if(log){ banner.style.display='none'; return; }
  banner.style.display = 'block';
  banner.textContent = `Oggi tocca: ${scheduled.key} · ${scheduled.name} — non ancora registrato`;
}

function renderDayChoices(){
  renderReminderBanner();
  const p = activeProgram();
  if(!logDateInput.value) logDateInput.value = new Date().toISOString().slice(0,10);
  const iso = logDateInput.value;
  const wd = WEEKDAYS[new Date(iso+'T00:00:00').getDay()];
  const scheduled = p.days.find(d=>d.weekday===wd);

  const dispEl = document.getElementById('logDateDisplay');
  if(dispEl) dispEl.textContent = formatDateLungo(iso);

  const wrap = document.getElementById('dayChoiceChips');
  wrap.innerHTML = "";
  selectedDayKey = null;

  // Tendina (31/08/2026): un'unica <option> per scelta, niente più icone SVG
  // per riga (il <select> nativo non le rende comunque). Placeholder vuoto e
  // disabilitato finché nessun giorno è ancora selezionato, per non far
  // sembrare "già scelto" il primo giorno solo perché è il primo in lista
  // (comportamento identico a prima, quando nessuna chip era evidenziata).
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Scegli —';
  placeholder.disabled = true;
  placeholder.selected = true;
  wrap.appendChild(placeholder);

  const creaOpzione = (key, label) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    wrap.appendChild(opt);
  };

  p.days.forEach(d=> creaOpzione(d.key, d.key + " · " + d.name));
  // "Allenamento libero" non è più una scelta qui (31/08/2026): è stato
  // scorporato ed è ora un ingresso diretto dal menu del "+" (vedi
  // fabOptLibero più sotto), che chiama selectDay('LIBERO') senza passare
  // da questa tendina. La logica di selectDay('LIBERO')/FREE_DAY resta
  // intatta e funziona identica anche senza questa opzione.
  creaOpzione("SKIP", "Saltato");

  const info = document.getElementById('statusInfo');
  // 31/08/2026: il banner di stato ha un tono neutro di base (vedi
  // .info-banner in style.css) — qui, prima che selectDay() imposti un
  // tono più specifico (esito-positivo/esito-attenzione), riparte sempre
  // pulito così non resta appiccicato il tono del giorno scelto in
  // precedenza.
  info.className = 'info-banner';
  info.textContent = scheduled ? `Di ${wd} è previsto: ${scheduled.key} · ${scheduled.name}` : `${wd} non è un giorno previsto dalla scheda.`;

  document.getElementById('riscaldamentoCard').style.display='none';
  document.getElementById('exerciseFormCard').style.display='none';
  document.getElementById('notesCard').style.display='none';
  document.getElementById('saveLogBtn').style.display='none';

  if(scheduled) selectDay(scheduled.key);
}

function selectDay(key){
  setTimeout(aggiornaVisibilitaTimer, 0);
  if(_bozzaPronta && key !== selectedDayKey){
    document.getElementById('bozzaBanner').style.display = 'none';
    // La registrazione in corso non sparisce da sola: se stai passando a un altro
    // giorno e ci sono dati inseriti, chiedo conferma prima di lasciarli andare.
    const _p = activeProfile();
    const b = _p && _p.bozzaLog;
    if(b && b.dayKey !== key){
      const conDati = Object.keys(b.serie||{}).some(n =>
        (b.serie[n]||[]).some(s => CAMPI_SERIE.some(k=>s[k]))) || (b.note||'').trim();
      if(conDati){
        const nomeGiorno = b.dayKey === "LIBERO" ? "Allenamento libero" : "giorno " + b.dayKey;
        customConfirm(
          `Hai una registrazione in corso (${nomeGiorno}) non ancora salvata. Passando a un altro giorno la perdi. Vuoi continuare?`,
          ()=>{ _p.bozzaLog = null; save(); selectDay(key); }
        );
        return;   // resto dov'ero finché non confermi
      }
      _p.bozzaLog = null; save();
    }
  }
  selectedDayKey = key;
  const selDay = document.getElementById('dayChoiceChips');
  if(selDay && selDay.value !== key) selDay.value = key;
  // 31/08/2026: prima il cronometro ripartiva da zero SOLO se si cambiava
  // giorno (key !== selectedDayKey precedente) — segnalato dall'utente che
  // "a volte continua dal tempo della sessione precedente invece di
  // azzerarsi rientrando in Registra". Capita per esempio riaprendo
  // "Allenamento libero" dal menu del "+" quando era già quello il giorno
  // scelto: senza un vero allenamento in corso da riprendere, l'utente si
  // aspetta un cronometro azzerato, non quello lasciato indietro. Chi
  // davvero deve riprendere un cronometro già avviato (ripristinaBozza, che
  // resta l'unico caso legittimo) lo fa scrivendo _logIniziatoAlle SUBITO
  // DOPO aver chiamato selectDay — quindi qui si può azzerare sempre senza
  // rompere quel percorso.
  if(key === "SKIP"){ _logIniziatoAlle = null; }
  else { _logIniziatoAlle = new Date().toISOString(); }
  // stesso discorso di _logIniziatoAlle qui sopra: riparte azzerato a ogni
  // scelta di giorno, e chi deve riprendere una bozza in corso (ripristinaBozza)
  // lo sovrascrive subito dopo con quanto salvato.
  _allenamentoATempo = false;
  _allenamentoATempoBloccato = false;
  _riscaldamentoNascosto = false;
  if(typeof aggiornaCronometroAllenamento === 'function') aggiornaCronometroAllenamento();

  const p = activeProgram();
  const iso = logDateInput.value;
  const wd = WEEKDAYS[new Date(iso+'T00:00:00').getDay()];
  const scheduled = p.days.find(d=>d.weekday===wd);
  const info = document.getElementById('statusInfo');

  if(key==="SKIP"){
    document.getElementById('freeAddExBtn').style.display='none';
  document.getElementById('freeAddExManualeBtn2').style.display='none';
    document.getElementById('freeEmptyHint').style.display='none';
    info.className = 'info-banner';
    info.innerHTML = `<span class="status-badge skip">Saltato</span> Nessun esercizio da registrare per questo giorno.`;
    document.getElementById('riscaldamentoCard').style.display='none';
    document.getElementById('exerciseFormCard').style.display='none';
    document.getElementById('notesCard').style.display='block';
    document.getElementById('saveLogBtn').style.display='block';
    currentSetInputs = {};
    return;
  }

  if(key==="LIBERO"){
    info.className = 'info-banner esito-attenzione';
    info.innerHTML = `<span class="status-badge warn">Allenamento libero</span>`;
    FREE_DAY.exercises = [];
    currentSetInputs = {};
    buildExerciseForm(FREE_DAY);
    document.getElementById('freeAddExBtn').style.display='block';
  document.getElementById('freeAddExManualeBtn2').style.display='block';
    document.getElementById('freeEmptyHint').style.display='block';
    document.getElementById('exerciseFormCard').style.display='none';
    document.getElementById('notesCard').style.display='block';
    document.getElementById('saveLogBtn').style.display='block';
    return;
  }
  document.getElementById('freeAddExBtn').style.display='none';
  document.getElementById('freeAddExManualeBtn2').style.display='none';
  document.getElementById('freeEmptyHint').style.display='none';

  const day = p.days.find(d=>d.key===key);
  if(scheduled && scheduled.key===key){
    info.className = 'info-banner esito-positivo';
    info.innerHTML = `<span class="status-badge ok">Come da programma</span> ${wd}: ${day.key} · ${day.name}`;
  } else {
    info.className = 'info-banner esito-attenzione';
    info.innerHTML = `<span class="status-badge warn">Giorno diverso dal previsto</span> Hai scelto ${day.key} · ${day.name}`;
  }

  buildExerciseForm(day);
  document.getElementById('exerciseFormCard').style.display='block';
  document.getElementById('notesCard').style.display='block';
  document.getElementById('saveLogBtn').style.display='block';
}

// Riscaldamento suggerito (01/09/2026): niente da compilare in scheda, si
// calcola da solo dai gruppi muscolari già taggati sugli esercizi del giorno
// (vedi suggerisciRiscaldamento() in costanti.js). Solo per giorni veri della
// scheda: "Allenamento libero" non ha una lista fissa di gruppi finché non
// scegli almeno un esercizio, quindi lì la card resta nascosta.
function renderRiscaldamentoSuggerito(day){
  const card = document.getElementById('riscaldamentoCard');
  if(!card) return;
  if(day.key === 'LIBERO' || _riscaldamentoNascosto){ card.style.display = 'none'; return; }
  const voci = suggerisciRiscaldamento(day);
  if(!voci.length){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  document.getElementById('riscaldamentoSub').textContent =
    "In base ai gruppi muscolari di oggi — solo una guida, non entra nell'allenamento registrato.";
  const list = document.getElementById('riscaldamentoList');
  list.innerHTML = voci.map((v,i)=>`
    <div class="riscaldamento-item" data-i="${i}">
      <div class="ri-txt">
        <span class="ri-nome">${escapeAttr(v.n)}</span>
        <span class="ri-target">${escapeAttr(v.target)}${v.rec ? ` · ⏱ ${v.rec}s recupero` : ''}</span>
      </div>
      <button type="button" class="ri-fatto-btn" aria-label="Segna fatto" title="Segna fatto">✓</button>
    </div>`).join('');
  list.querySelectorAll('.ri-fatto-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{ btn.closest('.riscaldamento-item').classList.toggle('fatto'); });
  });
}
document.getElementById('riscaldamentoSaltaBtn').addEventListener('click', ()=>{
  _riscaldamentoNascosto = true;
  document.getElementById('riscaldamentoCard').style.display = 'none';
});

function buildExerciseForm(day){
  mostraPopupAllenamentoATempo(day);
  renderRiscaldamentoSuggerito(day);
  document.getElementById('exerciseFormTitle').textContent = day.key + " · " + day.name;
  const list = document.getElementById('exerciseFormList');
  list.innerHTML = "";
  currentSetInputs = {};
  _dropsetPerEsercizio = {};
  _exerciseByName = {};

  day.exercises.forEach((ex, i)=>{
    currentSetInputs[ex.name] = [];
    _exerciseByName[ex.name] = ex;
    const block = document.createElement('div');
    block.className='exercise-block';
    block.dataset.exIndex = i;
    const videoInfo = getExerciseVideoInfo(ex.name);
    const prec = ultimaPrestazione(ex.name, document.getElementById('logDate').value);
    const rigaPrec = prec
      ? `<div class="ultima-volta">Ultima volta (${formatDate(prec.data)}): <b>${descriviSerie(prec.serie, ex.name, ex.dropset)}</b>
           <button type="button" class="riporta-btn" data-riporta="${escapeAttr(ex.name)}">riporta</button></div>`
      : `<div class="ultima-volta vuota">Prima volta che registri questo esercizio.</div>`;
    const nota = ex.note ? `<div class="exercise-note">📌 ${escapeAttr(ex.note)}</div>` : '';
    // Progressione automatica (01/09/2026): se il PT ne ha impostata una su
    // questo esercizio, mostro il peso calcolato per la settimana in corso
    // — solo un suggerimento, il cliente registra comunque il peso che vuole.
    // Il controllo su ex.progressione PRIMA di chiamare activeProgram() non è
    // solo un'ottimizzazione: buildExerciseForm() viene chiamata anche con
    // profili "minimi" senza affatto un array `programs` (es. costruendo a
    // mano un giorno per un test, o in scenari difensivi) — chiamare
    // activeProgram() lì manderebbe in crash l'intera schermata per un
    // suggerimento che comunque non ci sarebbe da mostrare.
    const pesoSuggerito = (ex.progressione && ex.progressione.attiva)
      ? pesoProgressivo(ex, activeProgram()) : null;
    const rigaProg = pesoSuggerito!=null
      ? `<div class="progressione-suggerita">📈 Suggerito questa settimana: <b>${pesoSuggerito} kg</b></div>` : '';
    const partnerIdx = ex.supersetCon!=null ? ex.supersetCon : chiMiHaAbbinato(day, i);
    const partner = (partnerIdx!=null && partnerIdx>=0) ? day.exercises[partnerIdx] : null;
    const supersetBadge = partner ? `<div class="superset-badge">⚡ Superset con <b>${escapeAttr(partner.name)}</b>
        <button type="button" class="superset-vai" data-vai="${partnerIdx}">Vai →</button></div>` : '';
    // Allenamento libero: senza più un carosello non c'è un "esercizio
    // attivo" su cui far agire un tasto "Togli esercizio" globale — ognuno ha
    // quindi il proprio tasto di rimozione (sostituisce il vecchio #freeDelExBtn).
    const rimuoviBtn = day.key === 'LIBERO'
      ? `<button type="button" class="ex-remove-btn" data-exidx="${i}" title="Togli esercizio" aria-label="Togli esercizio">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12"/></svg>
         </button>`
      : '';
    // Nell'allenamento libero non c'è una scheda pre-pianificata: la tecnica
    // (dropset/rest-pause/superset) si sceglie qui, esercizio per esercizio,
    // con lo stesso meccanismo già usato in "Modifica scheda".
    const tecnicaPicker = day.key === 'LIBERO' ? `
      <div class="tecnica-row">Tecnica speciale</div>
      <div class="seg-toggle seg-toggle-tecnica">
        <button type="button" class="seg-btn ${!ex.dropset && ex.supersetCon==null?'active':''}" data-libidx="${i}" data-tecnica="nessuna">Nessuna</button>
        <button type="button" class="seg-btn ${ex.dropset && ex.dropset.tipo==='dropset'?'active':''}" data-libidx="${i}" data-tecnica="dropset">Dropset</button>
        <button type="button" class="seg-btn ${ex.dropset && ex.dropset.tipo==='restpause'?'active':''}" data-libidx="${i}" data-tecnica="restpause">Rest-pause</button>
        <button type="button" class="seg-btn ${ex.supersetCon!=null?'active':''}" data-libidx="${i}" data-tecnica="superset">Superset</button>
      </div>
      ${ex.dropset && ex.dropset.drops ? `
      <div class="tecnica-extra-row">
        <button type="button" class="tecnica-extra-btn" data-libidx="${i}" data-azione="aggiungi">+ Aggiungi ${ex.dropset.tipo==='restpause'?'rest-pause':'drop'}</button>
        ${ex.dropset.drops.length>1 ? `<button type="button" class="tecnica-extra-btn rimuovi" data-libidx="${i}" data-azione="rimuovi">− Rimuovi ultimo</button>` : ''}
      </div>` : ''}` : '';
    // Recupero (01/09/2026, richiesta esplicita): non si vedeva da nessuna
    // parte in Registra, solo nella scheda. Niente badge se è la prima metà
    // di un superset (lì non c'è pausa, vedi supersetEditorHtml in scheda-editor.js).
    const recuperoBadge = (ex.recupero && ex.supersetCon==null)
      ? `<span class="ex-recupero-badge">⏱ ${ex.recupero}s recupero</span>` : '';
    block.innerHTML = `<div class="exercise-name">${ex.name}<span class="target">(target: ${descriviTargetSerie(ex)})</span>${recuperoBadge}
        <a href="${escapeAttr(videoInfo.url)}" data-ex-name="${escapeAttr(ex.name)}" class="video-link" style="margin-left:8px;">▶ Video</a>
        ${rimuoviBtn}</div>
      ${supersetBadge}
      ${nota}
      ${rigaProg}
      ${rigaPrec}
      ${tecnicaPicker}
      <div class="sets-container" data-ex="${escapeAttr(ex.name)}"></div>
      <button type="button" class="add-set" data-ex="${escapeAttr(ex.name)}">+ Aggiungi serie</button>`;
    list.appendChild(block);
    if(ex.dropset && ex.dropset.drops && ex.dropset.drops.length){
      _dropsetPerEsercizio[ex.name] = ex.dropset;
      for(let k=0;k<ex.sets;k++) buildDropsetRound(ex.name, k+1, ex.dropset, ex.reps);
    } else {
      for(let k=0;k<ex.sets;k++) addSetRow(ex.name);
    }
  });
  if(day.key === 'LIBERO'){
    list.querySelectorAll('.seg-toggle-tecnica .seg-btn[data-libidx]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const i = parseInt(btn.dataset.libidx);
        const tecnica = btn.dataset.tecnica;
        const ex = FREE_DAY.exercises[i];
        if(!ex) return;
        scollegaSuperset(FREE_DAY, i);   // riparto sempre pulito, come nell'editor scheda
        delete ex.dropset;
        if(tecnica === 'dropset'){
          ex.dropset = { tipo:'dropset', drops: [{ riduzione:25 }] };
        } else if(tecnica === 'restpause'){
          ex.dropset = { tipo:'restpause', drops: [{ riduzione:0 }] };
        } else if(tecnica === 'superset'){
          const valido = j => j>=0 && j<FREE_DAY.exercises.length && j!==i && FREE_DAY.exercises[j] && FREE_DAY.exercises[j].name;
          let partner = null;
          if(valido(i+1)) partner = i+1;
          else if(valido(i-1)) partner = i-1;
          else { const altri = FREE_DAY.exercises.map((e2,j)=>j).filter(valido); if(altri.length>0) partner = altri[0]; }
          if(partner!=null) collegaSuperset(FREE_DAY, i, partner);
          else toast("Aggiungi prima un altro esercizio per creare un superset.");
        }
        rebuildFreeForm();   // ricostruisce mantenendo le serie già digitate sugli altri esercizi
      });
    });
    // + Aggiungi drop/rest-pause: aumenta le tappe di OGNI round (stesso meccanismo
    // di "Modifica scheda"). − Rimuovi ultimo fa l'inverso, restando sempre almeno a 1.
    list.querySelectorAll('.tecnica-extra-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const i = parseInt(btn.dataset.libidx);
        const ex = FREE_DAY.exercises[i];
        if(!ex || !ex.dropset || !ex.dropset.drops) return;
        const tipo = ex.dropset.tipo;
        if(btn.dataset.azione === 'aggiungi'){
          ex.dropset.drops.push({ riduzione: tipo==='restpause'?0:25 });
        } else if(ex.dropset.drops.length>1){
          ex.dropset.drops.pop();
        }
        rebuildFreeForm();
      });
    });
  }
  list.querySelectorAll('.add-set').forEach(btn=>btn.addEventListener('click', ()=>{
    const nome = btn.dataset.ex;
    const ds = _dropsetPerEsercizio[nome];
    if(ds){
      const numeroRound = Math.floor(currentSetInputs[nome].length / (1+ds.drops.length)) + 1;
      buildDropsetRound(nome, numeroRound, ds);
    } else {
      addSetRow(nome);
    }
  }));
  list.querySelectorAll('[data-riporta]').forEach(btn=>btn.addEventListener('click', ()=>riportaUltimaVolta(btn.dataset.riporta)));
  // Lista verticale (31/08/2026): "Vai →" del superset non cambia più
  // esercizio in un carosello, scorre semplicemente fino al blocco del
  // partner, che è già visibile insieme a tutti gli altri.
  list.querySelectorAll('.superset-vai').forEach(btn=>btn.addEventListener('click', ()=>{
    const target = list.querySelector(`.exercise-block[data-ex-index="${parseInt(btn.dataset.vai)}"]`);
    if(target) target.scrollIntoView({behavior:'smooth', block:'center'});
  }));
  list.querySelectorAll('.ex-remove-btn[data-exidx]').forEach(btn=>btn.addEventListener('click', ()=>{
    const i = parseInt(btn.dataset.exidx);
    const ex = FREE_DAY.exercises[i];
    if(!ex){ toast("Nessun esercizio da togliere."); return; }
    customConfirm(`Togliere "${ex.name}" dall'allenamento di oggi?`, ()=>{
      delete currentSetInputs[ex.name];
      FREE_DAY.exercises.splice(i,1);
      if(FREE_DAY.exercises.length===0){
        currentSetInputs = {};
        document.getElementById('exerciseFormCard').style.display='none';
        document.getElementById('freeEmptyHint').style.display='block';
      } else {
        rebuildFreeForm();
      }
      salvaBozza();
      toast("Esercizio rimosso");
    });
  }));
}


// ============================================================
// ESERCIZI (Registra) — lista verticale.
//
// Fino a questa versione era un carosello: un esercizio alla volta, con
// frecce/swipe per passare al successivo, e tutta una macchina di calcolo
// altezze/animazioni per evitare che si vedesse un "fantasma" dell'esercizio
// precedente durante il cambio (bug segnalato più volte, l'ultima su
// Military Press). Richiesta esplicita (31/08/2026): "toglierei il carosello
// degli esercizi e li metterei uno sotto l'altro così da non avere bug di
// nessun tipo sul carosello" — con tutti gli esercizi semplicemente impilati
// e sempre visibili non c'è più nulla da animare, misurare o indovinare: le
// funzioni currentExerciseIndex/aggiornaControlliCarosello/
// osservaAltezzaEsercizioAttivo/inizializzaCarosello/mostraEsercizio, le
// frecce #exPrevBtn/#exNextBtn e lo swipe non servono più e sono state tolte.
// `.exercise-block` resta il nome della classe di ogni riquadro (usata da
// addSetRow/riportaUltimaVolta per trovare gli input per nome esercizio, e da
// diversi test) ma ora è un blocco normale nel flusso della pagina, non più
// position:absolute — vedi css/style.css.

// isFineRound: questa riga chiude un round (nessun'altra tappa la segue) —
// vera di default per una serie semplice (tappa non passata), false per la
// principale e le tappe intermedie di un dropset/rest-pause, vera per la
// sua ultima tappa (vedi buildDropsetRound). Decide se segnarla "fatta" fa
// partire il recupero (avviaRecuperoSeATtempo): a metà di un dropset non c'è
// pausa da cronometrare, solo dopo l'ultima tappa del round.
function addSetRow(exName, tappa, isFineRound){
  const container = document.querySelector(`.sets-container[data-ex="${CSS.escape(exName)}"]`);
  const idx = currentSetInputs[exName].length;
  const campi = campiDi(exName);
  const fineRound = isFineRound !== undefined ? isFineRound : (typeof tappa !== 'number');

  const vuota = {};
  campi.forEach(c=>{ vuota[c.chiave] = ''; });
  // tappa: 0 = serie principale, 1/2/... = drop o rest-pause di quel round
  // (passata solo da buildDropsetRound). Viaggia con la riga fino al
  // salvataggio (vedi saveLogBtn) e serve a descriviSerie per raggruppare
  // "Ultima volta" secondo la struttura REALE di quel giorno, non secondo
  // la scheda di oggi — che nel frattempo può essere cambiata.
  if(typeof tappa === 'number') vuota._tappa = tappa;
  currentSetInputs[exName].push(vuota);

  const row = document.createElement('div');
  row.className = 'set-row';
  const pezzi = campi.map((c, i)=>
    `${i > 0 ? '<span class="x">×</span>' : ''}
     <input type="number" inputmode="${c.passo < 1 ? 'decimal' : 'numeric'}" step="${c.passo}"
            placeholder="${c.etichetta}" data-ex="${escapeAttr(exName)}" data-idx="${idx}"
            data-field="${c.chiave}"${campi.length === 1 ? ' style="flex:1;"' : ''}>
     ${c.unita ? `<span class="x">${c.unita}</span>` : ''}`).join('');
  row.innerHTML = `<span class="set-num">${idx+1}</span>${pezzi}
     <button type="button" class="set-fatta-btn" aria-label="Segna serie completata" title="Segna serie completata">✓</button>`;

  container.appendChild(row);
  row.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      currentSetInputs[inp.dataset.ex][inp.dataset.idx][inp.dataset.field] = valoreDaCampo(inp.dataset.ex, inp.dataset.field, inp.value);
      salvaBozza();
    });
  });
  // Segna la serie come fatta: unico trigger del recupero automatico
  // (Task "allenamento a tempo") — vedi avviaRecuperoSeATtempo(). La scelta
  // "a tempo" è già bloccata dal popup "Prima di iniziare" molto prima che
  // si arrivi qui, non serve più bloccarla da questo tasto.
  row.querySelector('.set-fatta-btn').addEventListener('click', ()=>{
    row.classList.toggle('fatta');
    const fatta = row.classList.contains('fatta');
    currentSetInputs[exName][idx]._fatta = fatta;
    if(fatta && fineRound) avviaRecuperoSeATtempo(exName);
    salvaBozza();
  });
}

// Ripartisce le ripetizioni "rimaste da fare" (target dell'esercizio meno
// quelle già fatte nella serie principale) tra le tappe successive del
// dropset, in numeri interi e decrescenti: ad ogni passo la tappa prende
// 2/(tappe rimaste+1) di quello che resta, così l'ultima tappa si prende
// sempre il resto. Con target 20 e serie principale 10: 2 drop → 6,4;
// 3 drop → 5,3,2 — sempre numeri "puliti", mai zero.
// Se il target non è leggibile (scheda senza reps numeriche, o la serie
// principale è già oltre il target) si ripartiscono le ripetizioni della
// serie principale stessa, per avere comunque una progressione sensata.
function calcolaRipartizioneRipetizioni(target, mainReps, tappe){
  if(tappe <= 0) return [];
  // Se il target è leggibile e la principale non lo ha già superato, alle tappe
  // successive spetta solo quello che manca per arrivarci: se la principale lo
  // ha già raggiunto in pieno (es. target 20, principale 20), alle tappe non
  // resta nulla da fare — 0, perché la serie deve ridare sempre e solo il
  // target, mai di più. Se il target invece non è leggibile (scheda senza reps
  // numeriche) o la principale è già oltre il target, si ripartiscono le
  // ripetizioni della principale stessa, per avere comunque una progressione.
  const targetRaggiungibile = Number.isFinite(target) && target >= mainReps;
  let restanti = targetRaggiungibile ? (target - mainReps) : mainReps;
  if(restanti === 0) return new Array(tappe).fill(0);
  if(!Number.isFinite(restanti) || restanti < tappe) restanti = tappe;   // mai zero ripetizioni in una tappa (fuori dal caso "target già raggiunto")
  const risultato = [];
  let daFare = tappe;
  while(daFare > 0){
    const parte = daFare === 1 ? restanti : Math.max(1, Math.floor(restanti * 2 / (daFare + 1)));
    risultato.push(parte);
    restanti -= parte;
    daFare--;
  }
  return risultato;
}

// Costruisce un "round" di dropset durante l'allenamento: la serie principale
// (un normale set-row, dove inserisci il peso vero che hai sollevato) seguita
// da una riga per ogni drop. Il peso di ogni drop si ricalcola da solo,
// ridotto della percentuale impostata rispetto al peso della tappa precedente
// (che sia la principale o il drop prima di lui) e arrotondato ai 5 kg più
// vicini — così i dischi restano quelli che hai davvero in palestra. Le
// ripetizioni dei drop si ricalcolano anche loro da sole, in base a quante ne
// scrivi nella serie principale (vedi calcolaRipartizioneRipetizioni sopra):
// basta compilare la serie principale, il resto segue in automatico mentre
// resta comunque modificabile a mano se vuoi correggerlo.
function buildDropsetRound(exName, numeroRound, dropset, targetReps){
  const container = document.querySelector(`.sets-container[data-ex="${CSS.escape(exName)}"]`);
  const target = parseInt(targetReps, 10);

  // false: la principale non chiude mai il round, seguono sempre le tappe
  addSetRow(exName, 0, false);
  let rigaPrec = container.lastElementChild;
  rigaPrec.classList.add('drop-row', 'drop-row-main');
  etichettaRiga(rigaPrec, `Serie ${numeroRound} · Principale`);
  let kgPrec = rigaPrec.querySelector('[data-field="kg"]');
  const repsPrincipale = rigaPrec.querySelector('[data-field="reps"]');
  const righeDrop = [];   // {repsInput, idx} di ogni tappa, per il ricalcolo ripetizioni qui sotto
  const drops = dropset.drops || [];

  drops.forEach((drop, dj)=>{
    addSetRow(exName, dj+1, dj === drops.length-1);   // solo l'ultima tappa chiude il round
    const riga = container.lastElementChild;
    riga.classList.add('drop-row');
    const nomeTappa = dropset.tipo==='restpause' ? `Rest-pause ${dj+1}` : `Drop ${dj+1} (-${drop.riduzione||0}%)`;
    etichettaRiga(riga, nomeTappa);
    const idx = currentSetInputs[exName].length - 1;

    const repsInput = riga.querySelector('[data-field="reps"]');
    if(repsInput) righeDrop.push({repsInput, idx});

    const kgInput = riga.querySelector('[data-field="kg"]');
    const kgSorgente = kgPrec;   // fisso qui il riferimento: ogni drop deve restare legato alla
                                 // tappa che aveva sopra, non a quella dell'ultimo giro del ciclo
    if(kgInput && kgSorgente){
      kgInput.classList.add('drop-kg-auto');
      kgInput.placeholder = 'auto';
      const ricalcola = ()=>{
        const base = parseFloat(kgSorgente.value);
        if(isNaN(base)) return;
        const calcolato = Math.round(base * (1 - (drop.riduzione||0)/100) / 5) * 5;   // arrotondo ai 5 kg
        kgInput.value = calcolato;
        currentSetInputs[exName][idx].kg = calcolato;
        kgInput.dispatchEvent(new Event('input', {bubbles:true}));   // così il calcolo scende anche ai drop successivi
        salvaBozza();
      };
      kgSorgente.addEventListener('input', ricalcola);
      ricalcola();
      kgPrec = kgInput;   // il prossimo drop parte dal peso di questo
    }
  });

  if(repsPrincipale && righeDrop.length){
    const ricalcolaRipetizioni = ()=>{
      const mainReps = parseInt(repsPrincipale.value, 10);
      if(!Number.isFinite(mainReps) || mainReps <= 0){
        // la principale è vuota (o è stata cancellata dopo un calcolo
        // precedente): non lascio le tappe con ripetizioni "vecchie" e non più valide
        righeDrop.forEach(r=>{
          r.repsInput.value = '';
          currentSetInputs[exName][r.idx].reps = '';
        });
        salvaBozza();
        return;
      }
      const parti = calcolaRipartizioneRipetizioni(target, mainReps, righeDrop.length);
      righeDrop.forEach((r, i)=>{
        r.repsInput.value = String(parti[i]);
        currentSetInputs[exName][r.idx].reps = String(parti[i]);
      });
      salvaBozza();
    };
    repsPrincipale.addEventListener('input', ricalcolaRipetizioni);
    ricalcolaRipetizioni();
  }
}
function etichettaRiga(riga, testo){
  const num = riga.querySelector('.set-num');
  if(num){ num.textContent = testo; num.classList.add('drop-row-label'); }
}

document.getElementById('saveLogBtn').addEventListener('click', ()=>{
  const prof = activeProfile();
  const p = activeProgram();
  const iso = logDateInput.value;
  if(selectedDayKey===null){ toast("Seleziona un giorno prima di salvare."); return; }

  const log = {
    id: uid(), date: iso, programId: p.id,
    status: selectedDayKey==="SKIP" ? "saltato" : "registrato",
    dayKey: selectedDayKey==="SKIP" ? null : selectedDayKey,
    dayName: selectedDayKey==="SKIP" ? null
             : selectedDayKey==="LIBERO" ? "Allenamento libero"
             : p.days.find(d=>d.key===selectedDayKey).name,
    exercises: [], notes: document.getElementById('logNotes').value.trim()
  };
  if(selectedDayKey!=="SKIP"){
    Object.keys(currentSetInputs).forEach(exName=>{
      const sets = currentSetInputs[exName].filter(s=>CAMPI_SERIE.some(k=>s[k]));
      if(sets.length>0) log.exercises.push({name: exName, sets: sets.map(s=>{
        const salvata = {reps:s.reps||'', kg:s.kg||'', seconds:s.seconds||''};
        if(typeof s._tappa === 'number') salvata.tappa = s._tappa;   // vedi addSetRow: usata da descriviSerie
        return salvata;
      })});
    });
  }
  // record personali: il "prima" va calcolato PRIMA di aggiungere il log
  // appena compilato, così un miglioramento viene festeggiato solo se batte
  // un record VERO già esistente — il primissimo log di un esercizio non è
  // "un record battuto", è solo il primo dato.
  const recordPrima = {};
  log.exercises.forEach(e=>{ recordPrima[e.name] = recordPersonale(prof, e.name); });

  // se quel giorno era stato segnato saltato in automatico, la scelta manuale ha la precedenza
  prof.logs = prof.logs.filter(l => !(l.auto && l.date===iso && l.programId===p.id));
  prof.logs.push(log);

  const nuoviRecord = [];
  log.exercises.forEach(e=>{
    const prima = recordPrima[e.name];
    const dopo = recordPersonale(prof, e.name);
    if(prima && dopo && dopo.valore > prima.valore){
      nuoviRecord.push({ nome: e.name, valore: dopo.valore, timeBased: isTimeBasedExercise(e.name) });
    }
  });

  if(log.status === 'registrato' && _logIniziatoAlle){
    log.durataMinuti = Math.max(1, Math.round((Date.now() - new Date(_logIniziatoAlle).getTime()) / 60000));
  }
  prof.bozzaLog = null;
  FREE_DAY.exercises = [];
  currentSetInputs = {};
  selectedDayKey = null;
  _logIniziatoAlle = null;
  _allenamentoATempo = false;
  _allenamentoATempoBloccato = false;
  _riscaldamentoNascosto = false;
  save();
  toast("Allenamento salvato ✓");
  if(nuoviRecord.length > 0){
    // il toast è a slot unico (vedi toast()): il messaggio "Allenamento
    // salvato" deve finire di mostrarsi prima che parta quello del record,
    // altrimenti si sovrascriverebbero a vicenda.
    const messaggioRecord = nuoviRecord.length === 1
      ? `🏆 Nuovo record${nuoviRecord[0].timeBased ? '' : ' stimato'}: ${nuoviRecord[0].nome} ${nuoviRecord[0].valore}${nuoviRecord[0].timeBased ? ' sec' : ' kg'}`
      : `🏆 ${nuoviRecord.length} nuovi record stimati oggi: ${nuoviRecord.map(r=>r.nome).join(', ')}`;
    setTimeout(()=>toast(messaggioRecord), 2500);
  }
  document.getElementById('bozzaBanner').style.display = 'none';
  document.getElementById('riscaldamentoCard').style.display = 'none';
  document.getElementById('exerciseFormCard').style.display = 'none';
  document.getElementById('notesCard').style.display = 'none';
  document.getElementById('saveLogBtn').style.display = 'none';
  document.getElementById('freeAddExBtn').style.display = 'none';
  document.getElementById('freeAddExManualeBtn2').style.display='none';
  document.getElementById('freeEmptyHint').style.display = 'none';
  document.getElementById('logNotes').value = "";
  renderHeader();
  renderDayChoices();
  // 31/08/2026 (quinto giro, richiesta esplicita): finito di registrare
  // restava sulla schermata di Registra, ormai vuota/azzerata — riporta in
  // Home, che intanto mostra già "Fatto oggi ✓" (aggiornaHomeCta() viene
  // richiamata da mostraHome()).
  mostraHome();
});

// ============================================================
