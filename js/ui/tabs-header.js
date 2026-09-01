// TABS
// ============================================================
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-'+btn.dataset.tab).classList.add('active');
    // 01/09/2026: "Piano alimentare assegnato dal PT" ora è una finestra a
    // schermo intero (vedi .diet-plan-toggle[open]) — lasciarla aperta
    // mentre si cambia tab la nasconderebbe (la sezione Dieta passa a
    // display:none) senza però sbloccare lo scroll della pagina sotto,
    // stesso problema già risolto per i giorni della scheda con
    // giorno-fullscreen-aperto. La richiudo appena si esce da Dieta.
    if(btn.dataset.tab!=='diet'){
      const pianoPT = document.getElementById('pianoPTDetails');
      if(pianoPT && pianoPT.open) pianoPT.open = false;
      document.body.classList.remove('dieta-window-aperta');
    }
    if(btn.dataset.tab==='log'){
      if(!_bozzaPronta) ripristinaBozza();
      // il giorno di oggi può essere già stato scelto in automatico in
      // sottofondo (renderAll() al login, per il promemoria in Home): il
      // popup "Prima di iniziare" era rimasto in sospeso fino a questo punto,
      // adesso che la schermata è davvero questa lo mostra — vedi
      // mostraPopupAllenamentoATempo() in registra.js.
      if(typeof aggiornaPopupATempoInSospeso === 'function') aggiornaPopupATempoInSospeso();
    }
    aggiornaVisibilitaTimer();
    if(btn.dataset.tab==='diet'){ renderMealDiary(); renderDietPlanView(); renderDietEditForm(); segnaVistaCliente('dieta'); }
    if(btn.dataset.tab==='history'){ renderHistory(); renderVolume(); renderMeasurements(); }
    if(btn.dataset.tab==='program'){ renderProgramView(); renderNewProgramForm(); segnaVistaCliente('scheda');
      if(typeof renderMioPT === 'function' && modalitaOnline()) renderMioPT(); }
    aggiornaNavGlobale(btn.dataset.tab);
  });
});

// nav visibile: Scheda/Dieta/Glossario mostrano appRoot e cliccano "per conto loro"
// il tab corrispondente nella nav storica; Home e Account riusano le funzioni esistenti.
// Il "+" (31/08/2026): non apre più Registra direttamente, apre il menu con le
// 3 scelte (Registra allenamento / Allenamento libero / Registra pasto). Gli
// altri ingressi che chiamano apriRegistra() direttamente (puntino della
// settimana in Scheda, CTA "Registra questo allenamento" in Home) restano
// invariati e continuano a saltare il menu.
function apriFabMenu(){
  document.getElementById('fabMenuOverlay').classList.add('show');
  document.getElementById('fabRegistraBtn').classList.add('aperto');
}
function chiudiFabMenu(){
  document.getElementById('fabMenuOverlay').classList.remove('show');
  document.getElementById('fabRegistraBtn').classList.remove('aperto');
}
function toggleFabMenu(){
  document.getElementById('fabMenuOverlay').classList.contains('show') ? chiudiFabMenu() : apriFabMenu();
}
document.getElementById('fabRegistraBtn').addEventListener('click', toggleFabMenu);
document.getElementById('fabMenuOverlay').addEventListener('click', (e)=>{
  if(e.target.id === 'fabMenuOverlay') chiudiFabMenu();
});
// 31/08/2026: segnalato dall'utente che scegliendo "Allenamento libero" e poi
// "Registra allenamento" (per tornare a seguire la scheda) si resta bloccati
// sulla vista di Allenamento libero. Causa: nulla riportava selectedDayKey a
// "nessun giorno scelto" rientrando da qui — a differenza del cambio giorno
// dentro Registra (tendina), che passa sempre da selectDay() e dal suo
// controllo di sicurezza sui dati non salvati. Questa funzione fa la stessa
// cosa quando si arriva dal menu del "+": se l'Allenamento libero in corso
// ha dati non salvati chiede conferma prima di abbandonarlo (stesso testo/
// comportamento già usato in selectDay), altrimenti pulisce e torna subito
// alla scelta del giorno.
function tornaAllaSceltaGiorno(){
  if(selectedDayKey !== 'LIBERO') return;
  const prof = activeProfile();
  const b = prof && prof.bozzaLog;
  const conDati = !!(b && b.dayKey === 'LIBERO' && (
    Object.keys(b.serie||{}).some(n => (b.serie[n]||[]).some(s => CAMPI_SERIE.some(k=>s[k]))) || (b.note||'').trim()
  ));
  const esegui = ()=>{
    if(prof && prof.bozzaLog && prof.bozzaLog.dayKey === 'LIBERO'){ prof.bozzaLog = null; save(); }
    selectedDayKey = null;
    _logIniziatoAlle = null;
    currentSetInputs = {};
    FREE_DAY.exercises = [];
    document.getElementById('freeAddExBtn').style.display = 'none';
    document.getElementById('freeAddExManualeBtn2').style.display = 'none';
    document.getElementById('freeEmptyHint').style.display = 'none';
    document.getElementById('exerciseFormCard').style.display = 'none';
    document.getElementById('notesCard').style.display = 'none';
    document.getElementById('saveLogBtn').style.display = 'none';
    document.getElementById('bozzaBanner').style.display = 'none';
    if(typeof aggiornaCronometroAllenamento === 'function') aggiornaCronometroAllenamento();
    renderDayChoices();
  };
  if(conDati){
    customConfirm(
      "Hai un Allenamento libero in corso non ancora salvato. Tornando alla scheda lo perdi. Vuoi continuare?",
      esegui
    );
  } else {
    esegui();
  }
}
document.getElementById('fabOptAllenamento').addEventListener('click', ()=>{
  chiudiFabMenu();
  apriRegistra();
  tornaAllaSceltaGiorno();
});
document.getElementById('fabOptLibero').addEventListener('click', ()=>{
  chiudiFabMenu();
  apriRegistra();
  selectDay('LIBERO');
});
document.getElementById('fabOptPasto').addEventListener('click', ()=>{
  chiudiFabMenu();
  vaiA('diet');
  const input = document.getElementById('mealFoodInput');
  if(input){
    setTimeout(()=>{
      if(input.scrollIntoView) input.scrollIntoView({behavior:'smooth', block:'center'});
      input.focus({preventScroll:true});
    }, 60);
  }
});

document.querySelectorAll('#navTabsGlobale button[data-go]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    // Ritoccare la scheda su cui si è già (Dieta/Scheda diventano lunghe nel
    // tempo, tornare in cima a mano era scomodo): stesso gesto già familiare
    // su altre app (Instagram/Twitter) — torna in cima invece di ricaricare
    // la schermata da capo.
    if(btn.classList.contains('active')){
      window.scrollTo({top:0, behavior:'smooth'});
      return;
    }
    vaiA(btn.dataset.go);
    // 31/08/2026 (quarto giro, segnalato con screenshot): passando da una
    // schermata all'altra (es. da Dieta scorsa in basso a Scheda) restava
    // la stessa posizione di scorrimento di prima — la nuova schermata si
    // vedeva "già scorsa" invece che dall'inizio. Sopra c'era già lo stesso
    // scrollTo ma solo per il tocco sulla scheda GIÀ attiva; qui serve anche
    // quando si cambia scheda davvero.
    window.scrollTo(0, 0);
  });
});

// ---------- pulsante "torna su" ----------
// Compare solo dopo un po' di scorrimento verso il basso: su schermate lunghe
// (Dieta, Scheda con i loro editor) tornare in cima a mano era scomodo.
(function(){
  const btn = document.getElementById('backToTopBtn');
  if(!btn) return;
  let visibile = false;
  window.addEventListener('scroll', ()=>{
    const mostra = window.scrollY > 400;
    if(mostra !== visibile){ visibile = mostra; btn.classList.toggle('show', mostra); }
  }, {passive:true});
  btn.addEventListener('click', ()=>{ window.scrollTo({top:0, behavior:'smooth'}); });
})();


// Nasconde intestazione legacy ("Registro Allenamento"/striscia settimana),
// card "Il mio Personal Trainer" e nav in basso mentre si è su "Modifica
// scheda"/"Nuova scheda" (26/08/2026, richiesta esplicita: restava "tutto
// insieme" sopra all'editor) — stesso meccanismo già usato per Storico
// (apriStorico()). Richiamata sia dal toggle qui sotto sia da showAppRoot(),
// così anche tornare su Scheda da un'altra schermata con l'editor ancora
// aperto (es. dopo essere passati su Dieta) nasconde di nuovo il giusto.
function aggiornaChromeSchedaEditor(){
  const inEdit = document.getElementById('programEditBlock')?.style.display === 'block';
  const sticky = document.querySelector('.sticky-top');
  if(sticky) sticky.style.display = inEdit ? 'none' : '';
  document.body.classList.toggle('scheda-editor-aperto', inEdit);
  if(!inEdit) document.body.classList.remove('giorno-fullscreen-aperto');
  const cardPT = document.getElementById('cardMioPT');
  if(cardPT){
    if(inEdit) cardPT.style.display = 'none';
    // tornando su "Vedi": richiamo renderMioPT() invece di rimetterla a
    // 'block' a prescindere, così resta nascosta se non c'è un PT/si è
    // offline/si è tornati su Storico (stessa logica di sempre di quella
    // funzione, qui solo NON richiamata ad ogni ingresso in "Modifica scheda"
    // per non rifare la chiamata di rete a caricaRapporti() inutilmente).
    else if(typeof renderMioPT === 'function') renderMioPT();
  }
}
document.querySelectorAll('.seg-btn[data-seg]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.seg-btn[data-seg]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const isView = btn.dataset.seg==='view';
    document.getElementById('programViewBlock').style.display = isView ? 'block':'none';
    document.getElementById('programEditBlock').style.display = isView ? 'none':'block';
    if(!isView) applyEditFormVisibility();
    aggiornaChromeSchedaEditor();
  });
});

function applyEditFormVisibility(){
  document.getElementById('workoutEditCard').style.display = 'block';
  document.getElementById('workoutLockedCard').style.display = 'none';
}
function applyDietEditFormVisibility(){
  document.getElementById('dietInfoEditCard').style.display = 'block';
  document.getElementById('dietDayEditCard').style.display = 'block';
  document.getElementById('dietLockedCard').style.display = 'none';
}

document.querySelectorAll('.seg-btn[data-segd]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.seg-btn[data-segd]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const isView = btn.dataset.segd==='view';
    document.getElementById('dietPlanViewBlock').style.display = isView ? 'block':'none';
    document.getElementById('dietPlanEditBlock').style.display = isView ? 'none':'block';
    if(!isView) applyDietEditFormVisibility();
    // 31/08/2026: questi tasti vivono dentro "Piano alimentare assegnato dal
    // PT" — toccarli (o farli toccare da codice, es. modificaComePT) deve
    // aprirla, altrimenti il contenuto cambierebbe fuori dalla vista. Dal
    // 01/09/2026 quella finestra è a schermo intero (non più un accordion in
    // pagina): aggiorno anche il titolo mostrato nella barra in alto.
    const det = btn.closest('details');
    if(det) det.open = true;
    const dptTitle = document.getElementById('dptOpenTitle');
    if(dptTitle) dptTitle.textContent = isView ? 'Piano della settimana' : 'Modifica dieta';
  });
});

const ETICHETTA_SEG2 = { allenamenti:'Allenamenti', volume:'Volume', misure:'Misure' };
document.querySelectorAll('.seg-btn[data-seg2]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.seg-btn[data-seg2]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.seg2;
    document.getElementById('historyVolumeBlock').style.display = mode==='volume' ? 'block':'none';
    document.getElementById('historyLogsBlock').style.display = mode==='allenamenti' ? 'block':'none';
    document.getElementById('historyMisureBlock').style.display = mode==='misure' ? 'block':'none';
    if(mode==='misure') renderMeasurements();
    if(mode==='allenamenti') renderCalendarioStorico();
    // Il menu a tendina che ha sostituito i 3 tasti sempre in vista (25/08,
    // diciassettesimo giro): aggiorno l'etichetta e richiudo il menu.
    const label = document.getElementById('storicoMenuBtnLabel');
    if(label) label.textContent = ETICHETTA_SEG2[mode] || '';
    chiudiStoricoMenu();
  });
});
function chiudiStoricoMenu(){
  const menu = document.getElementById('storicoMenu');
  const btn = document.getElementById('storicoMenuBtn');
  if(!menu || !btn) return;
  menu.classList.remove('show');
  btn.setAttribute('aria-expanded', 'false');
}
(function(){
  const btn = document.getElementById('storicoMenuBtn');
  const menu = document.getElementById('storicoMenu');
  if(!btn || !menu) return;
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const aperto = menu.classList.toggle('show');
    btn.setAttribute('aria-expanded', aperto ? 'true' : 'false');
  });
  document.addEventListener('click', (e)=>{
    if(!menu.classList.contains('show')) return;
    if(e.target === btn || btn.contains(e.target) || menu.contains(e.target)) return;
    chiudiStoricoMenu();
  });
})();

// Toggle Scheda/Storico in cima alla Scheda: lo Storico è lo stesso contenuto che
// prima viveva nel tab dedicato (Volume/Allenamenti/Misure), solo spostato qui dentro.
document.querySelectorAll('.seg-btn[data-segprog]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.seg-btn[data-segprog]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const mostraStorico = btn.dataset.segprog === 'storico';
    document.getElementById('programSchedaBlock').style.display = mostraStorico ? 'none' : 'block';
    document.getElementById('programStoricoBlock').style.display = mostraStorico ? 'block' : 'none';
    if(mostraStorico){ renderHistory(); renderVolume(); renderMeasurements(); renderCalendarioStorico(); }
  });
});


function updateTabVisibility(){
  document.getElementById('tabBtnLog').style.display = 'flex';
  document.getElementById('tabBtnDiet').style.display = 'flex';
  document.getElementById('tabBtnProgram').style.display = 'flex';
}

// ============================================================
// HEADER
// ============================================================
function renderHeader(){
  const mainTitle = document.getElementById('mainTitle');
  const pulseBox = document.getElementById('weekPulse');
  const summaryBox = document.getElementById('quickSummary');

  mainTitle.textContent = 'Registro allenamento';
  pulseBox.style.display = 'flex';
  summaryBox.style.display = 'flex';

  const prof = activeProfile();
  const p = activeProgram();
  document.getElementById('programLabel').textContent = `${prof.name} · ${p.name} (dal ${formatDate(p.createdAt)})`;

  const pulse = pulseBox;
  pulse.innerHTML = "";
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay()+6)%7));
  const dataSelezionata = (document.getElementById('logDate') || {}).value || '';

  for(let i=0;i<7;i++){
    const d = new Date(monday);
    d.setDate(monday.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const wd = WEEKDAYS[d.getDay()];
    const scheduled = p.days.find(dy=>dy.weekday===wd);
    const log = prof.logs.find(l=>l.date===iso && l.programId===p.id);

    let dotClass = "";
    if(log){
      if(log.status==='saltato') dotClass='skip';
      else if(scheduled && log.dayKey===scheduled.key) dotClass='ok';
      else dotClass='warn';
    } else if(scheduled && d <= today){
      dotClass='skip';
    }
    const el = document.createElement('div');
    el.className='day' + (iso===dataSelezionata ? ' selected' : '');
    el.dataset.iso = iso;
    el.innerHTML = `<div class="wd">${wd.slice(0,3)}</div><div class="num">${d.getDate()}</div><div class="dot ${dotClass}"></div>`;
    el.addEventListener('click', ()=>{
      // 26/08/2026 (ventiduesimo giro): passa da apriRegistra(), non più da
      // un click diretto sul tab nascosto — altrimenti Registra si apriva
      // SENZA nascondere l'intestazione/nav (quel comportamento è demandato
      // solo ad apriRegistra(), vedi sopra), lasciando la nuova intestazione
      // dedicata di Registra impilata sopra quella condivisa ancora visibile.
      const tabRegistra = document.querySelector('.tab-btn[data-tab="log"]');
      if(tabRegistra && !tabRegistra.classList.contains('active')) apriRegistra();
      const input = document.getElementById('logDate');
      if(input){ input.value = iso; renderDayChoices(); renderHeader(); }
    });
    pulse.appendChild(el);
  }

  renderQuickSummary(prof, p);
}

function renderQuickSummary(prof, p){
  const box = document.getElementById('quickSummary');
  if(!p.days || p.days.length===0){ box.innerHTML = ''; return; }
  const today = new Date();
  const todayIso = today.toISOString().slice(0,10);

  // ultimo allenamento registrato (non saltato)
  const doneLogs = prof.logs.filter(l=>l.status!=='saltato').sort((a,b)=> b.date.localeCompare(a.date));
  let lastText = "Nessun allenamento registrato ancora";
  if(doneLogs.length>0){
    const last = doneLogs[0];
    const diffDays = Math.round((today - new Date(last.date+'T00:00:00')) / 86400000);
    const when = diffDays===0 ? "oggi" : diffDays===1 ? "ieri" : `${diffDays} giorni fa`;
    lastText = `Ultimo: ${last.dayKey||''} ${when}`;
  }

  // prossimo giorno di scheda previsto (guardando in avanti fino a 7 giorni)
  let nextText = "";
  for(let i=0;i<7;i++){
    const d = new Date(today); d.setDate(today.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const wd = WEEKDAYS[d.getDay()];
    const scheduled = p.days.find(dy=>dy.weekday===wd);
    if(!scheduled) continue;
    const log = prof.logs.find(l=>l.date===iso && l.programId===p.id);
    if(log) continue; // gia' fatto/saltato quel giorno
    const label = i===0 ? "oggi" : i===1 ? "domani" : wd;
    nextText = `Prossimo: ${scheduled.key} · ${scheduled.name} (${label})`;
    break;
  }

  box.innerHTML = `<span>${lastText}</span>${nextText ? `<span>${nextText}</span>` : ''}`;
}

// ============================================================
