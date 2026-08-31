// AGGIORNA / NUOVO PROGRAMMA
// ============================================================
let editingDays = [];
let editingDietInfo = {};
let editingDiet = {};

// Come si è entrati nell'editor scheda: 'modifica' (matita, sulla scheda già
// attiva) o 'nuova' (+ Nuova scheda). Serve a mostrare UN SOLO bottone di
// salvataggio alla volta invece di entrambi sempre assieme — segnalato
// "troppo incasinato"/inutile vedere "Salva come nuova versione" mentre si
// sta solo aggiornando (26/08/2026). Per il PT che modifica la scheda di un
// cliente (mostraEditorSchedaInlinePT) restano invece SEMPRE visibili
// entrambi, come prima: è l'unico punto d'ingresso che ha, non ha un
// "+Nuova scheda" separato per i clienti.
let _modoEditorScheda = 'modifica';

function renderNewProgramForm(){
  renderSchedaEditForm();
  renderDietEditForm();
}
function renderSchedaEditForm(){
  const p = activeProgram();
  editingDays = JSON.parse(JSON.stringify(p.days));
  document.getElementById('newProgramName').value = "";
  document.getElementById('newProgramDurata').value = p.durataSettimane || "";
  document.getElementById('newProgramNotePT').value = p.notePT || "";
  aggiornaModalitaEditorScheda();
  renderDayEditors();
  renderArchiveList();
  renderCustomExList();
  applyEditFormVisibility();
}

// Mostra/nasconde intestazione, campo "nome scheda" e i due bottoni di
// salvataggio in base a COME si è entrati nell'editor (_modoEditorScheda) —
// un solo bottone alla volta, niente più spiegazione lunga su cosa fanno
// "Aggiorna"/"Salva come nuova versione" quando in realtà se ne vede solo
// uno (26/08/2026). Il PT che modifica la scheda di un cliente fa eccezione:
// per lui restano sempre visibili entrambi, comportamento invariato.
function aggiornaModalitaEditorScheda(){
  const pt = !!(modalitaPT && _modificaPTCosa==='scheda' && _clienteAperto);
  const titolo2 = document.getElementById('programEditTitolo2');
  const introWrap = document.getElementById('programEditIntroWrap');
  const introHint = document.getElementById('programEditIntroHint');
  const hintNuova = document.getElementById('programEditHintNuova');
  const nomeWrap = document.getElementById('newProgramNameWrap');
  const btnAggiorna = document.getElementById('updateProgramBtn');
  const btnNuova = document.getElementById('saveNewProgramBtn');
  if(!titolo2 || !btnAggiorna || !btnNuova) return;

  if(pt){
    // comportamento di sempre, invariato: entrambi i bottoni e la spiegazione
    // completa, perché il PT non ha un "+Nuova scheda" separato per i clienti
    titolo2.textContent = `Scheda di ${nomeDi(_clienteAperto.riga)}`;
    if(introWrap) introWrap.style.display = '';
    if(introHint) introHint.style.display = '';
    if(hintNuova) hintNuova.style.display = 'none';
    if(nomeWrap) nomeWrap.style.display = 'block';
    btnAggiorna.style.display = 'block';
    btnNuova.style.display = 'block';
    btnNuova.textContent = 'Salva come nuova versione';
    return;
  }

  const nuova = _modoEditorScheda === 'nuova';
  titolo2.textContent = nuova ? 'Nuova scheda' : 'Modifica scheda';
  if(introWrap) introWrap.style.display = 'none';
  if(introHint) introHint.style.display = 'none';
  if(hintNuova) hintNuova.style.display = nuova ? 'block' : 'none';
  if(nomeWrap) nomeWrap.style.display = nuova ? 'block' : 'none';
  btnAggiorna.style.display = nuova ? 'none' : 'block';
  btnNuova.style.display = nuova ? 'block' : 'none';
  btnNuova.textContent = nuova ? 'Salva scheda' : 'Salva come nuova versione';
}

function renderDietEditForm(){
  const p = activeProgram();
  editingDietInfo = JSON.parse(JSON.stringify(p.dietInfo || defaultDietInfo()));
  editingDiet = (p.diet && typeof p.diet === 'object') ? JSON.parse(JSON.stringify(p.diet)) : defaultDietDays();
  const titolo = document.getElementById('dietEditTitolo');
  if(titolo){
    titolo.textContent = (modalitaPT && _modificaPTCosa==='dieta' && _clienteAperto)
      ? `Dieta di ${nomeDi(_clienteAperto.riga)}`
      : "Il personal trainer ti ha aggiornato la dieta?";
  }
  renderDietInfoEditors();
  renderDietDayEditors();
  applyDietEditFormVisibility();
}

// Una versione conta come "compilata" solo se ha almeno un giorno con
// almeno un esercizio, o almeno un giorno di dieta con qualcosa scritto
// (26/08, ventunesimo giro — prima bastava che la scheda fosse stata
// creata, anche vuota, per finire archiviata).
function giorniCompilati(days){
  return !!(days && days.length>0 && days.some(d=>d.exercises && d.exercises.length>0));
}
function dietaCompilata(diet){
  if(!diet || typeof diet !== 'object') return false;
  return Object.keys(diet).some(wd=>{
    const g = diet[wd];
    if(!g) return false;
    if(g.libera) return !!(g.testo && g.testo.trim());
    return !!((g.colazione||'').trim() || (g.pranzo||'').trim() || (g.spuntino||'').trim() || (g.cena||'').trim());
  });
}
function programmaVuoto(p){
  return !giorniCompilati(p.days) && !dietaCompilata(p.diet);
}

function renderArchiveList(){
  const prof = activeProfile();
  // Pulizia automatica: se in passato è stata archiviata una versione mai
  // compilata (tipicamente la scheda "bianca" di partenza di un profilo
  // nuovo), non ha senso tenerla in giro solo per ingombrare l'elenco —
  // la scartiamo qui, non solo per le nuove archiviazioni da questo giro
  // in poi (vedi i tre punti più sotto che impostano archivedAt).
  const daScartare = prof.programs.filter(p=>p.archivedAt && programmaVuoto(p));
  if(daScartare.length){
    prof.programs = prof.programs.filter(p=>!daScartare.includes(p));
    save();
  }
  const list = document.getElementById('archiveList');
  const archived = prof.programs.filter(p=>p.archivedAt);
  if(archived.length===0){ list.innerHTML = '<div class="empty">Nessuna scheda precedente.</div>'; return; }
  list.innerHTML = archived.slice().reverse().map(p=>`
    <details class="archive-sub-detail">
      <summary>
        <div class="pname">${p.name}</div>
        <div class="hint">dal ${formatDate(p.createdAt)} al ${formatDate(p.archivedAt)}</div>
      </summary>
      <div class="details-body" style="padding-left:18px;">
        ${renderProgramDetailHtml(p)}
        <button class="btn secondary block" data-reactivate="${p.id}" style="margin-top:10px;">Riattiva questa scheda</button>
      </div>
    </details>`).join('');

  list.querySelectorAll('[data-reactivate]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      customConfirm("Riattivare questa scheda? Quella attualmente attiva verrà archiviata al suo posto.", ()=>{
        const id = btn.dataset.reactivate;
        const current = activeProgram();
        if(programmaVuoto(current)){
          prof.programs = prof.programs.filter(p=>p.id!==current.id);
        } else {
          current.archivedAt = new Date().toISOString().slice(0,10);
        }
        const target = prof.programs.find(x=>x.id===id);
        target.archivedAt = null;
        prof.activeProgramId = target.id;
        save();
        renderHeader(); renderDayChoices(); renderProgramView(); renderNewProgramForm();
        toast("Scheda riattivata ✓");
      });
    });
  });
}

// ---- editor giorni allenamento ----
// Aggiorna solo la riga "Lunedì · 5 esercizi" nel riepilogo di un giorno,
// senza ridisegnare tutto l'accordion (altrimenti si perderebbe quale
// giorno è aperto in questo momento).
function aggiornaRiepilogoGiorno(di){
  const det = document.querySelector(`.day-accordion[data-di="${di}"]`);
  if(!det) return;
  const day = editingDays[di];
  if(!day) return;
  const hint = det.querySelector('.day-name-block .hint');
  if(hint){ const n = day.exercises.length; hint.textContent = `${day.weekday} · ${n} esercizi${n===1?'o':''}`; }
}
// "Un giorno alla volta" (richiesta esplicita dell'utente, 25/08 diciottesimo
// giro): aprendo una <details> di un giorno, chiudo tutte le altre — così
// non si vedono mai due giorni pieni di campi ed esercizi insieme.
function wireEsclusivitaGiorni(){
  const wrap = document.getElementById('dayEditors');
  wrap.querySelectorAll('.day-accordion').forEach(det=>{
    det.addEventListener('toggle', ()=>{
      if(det.open){
        wrap.querySelectorAll('.day-accordion').forEach(altro=>{ if(altro!==det) altro.open = false; });
      }
      // Un giorno aperto occupa tutto lo schermo (vedi CSS .day-accordion[open]):
      // blocco lo scorrimento della pagina sotto finché resta aperto, così non
      // "trascina" anche il resto della scheda mentre si scorre dentro al giorno.
      const unoAperto = !!wrap.querySelector('.day-accordion[open]');
      document.body.classList.toggle('giorno-fullscreen-aperto', unoAperto);
    });
  });
}
// Un giorno alla volta (richiesta esplicita dell'utente, 25/08 diciottesimo
// giro): ogni giorno è una <details> — riepilogo compatto quando chiusa
// (nome, giorno della settimana, N esercizi), stesso editor di sempre
// dentro quando aperta. Aprirne una chiude le altre (vedi wireEsclusivitaGiorni).
// Nota per i test: renderDayEditors() resta chiamabile così com'era prima
// (stesso nome, stesso comportamento su .ex-list[data-di]/#dayEditors) —
// dropset.test.js e storico-calendario-25-08.test.js la chiamano direttamente.
function renderDayEditors(){
  const wrap = document.getElementById('dayEditors');
  wrap.innerHTML = "";
  editingDays.forEach((day, di)=>{
    const box = document.createElement('details');
    box.className='day-editor day-accordion';
    box.dataset.di = di;
    const nEx = day.exercises.length;
    box.innerHTML = `
      <summary>
        <div class="letter">${day.key}</div>
        <div class="day-name-block">
          <div class="dname-riepilogo">${escapeAttr(day.name) || 'Senza nome'}</div>
          <div class="hint">${day.weekday} · ${nEx} esercizi${nEx===1?'o':''}</div>
        </div>
        <span class="day-accordion-chev">
          <svg class="day-accordion-apri" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          <svg class="day-accordion-chiudi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </span>
      </summary>
      <div class="details-body">
        <label style="margin-top:0;">Nome giorno</label>
        <input type="text" class="dname" data-di="${di}" value="${escapeAttr(day.name)}">
        <label>Giorno della settimana</label>
        <select class="dweekday" data-di="${di}">
          ${WD_ORDER.filter(w=>w!=="Domenica").map(w=>`<option value="${w}" ${w===day.weekday?'selected':''}>${w}</option>`).join('')}
        </select>
        <label>Categoria (facoltativa)</label>
        <select class="dcategoria" data-di="${di}">
          <option value="" ${!day.categoria?'selected':''}>Nessuna</option>
          ${Object.keys(CATEGORIE_ALLENAMENTO).map(k=>`<option value="${k}" ${day.categoria===k?'selected':''}>${CATEGORIE_ALLENAMENTO[k].label}</option>`).join('')}
        </select>
        <p class="hint" style="margin-top:2px;">Compare come etichetta sulla card del giorno in Storico.</p>
        <label>Esercizi</label>
        <div class="ex-list" data-di="${di}"></div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
          <button class="btn" data-di="${di}" data-action="pick-ex" style="margin-top:0; flex:1 1 190px;">Scegli dal corpo</button>
          <button class="btn ghost" data-di="${di}" data-action="add-ex" style="margin-top:0; flex:1 1 140px;">+ Riga vuota</button>
        </div>
        <button class="btn danger block" data-di="${di}" data-action="remove-day" style="margin-top:14px;">Rimuovi giorno</button>
      </div>
    `;
    wrap.appendChild(box);
    renderExerciseEditors(di);
  });
  wrap.querySelectorAll('.dname').forEach(inp=>inp.addEventListener('input', e=>{
    editingDays[e.target.dataset.di].name = e.target.value;
    const riep = e.target.closest('.day-accordion').querySelector('.dname-riepilogo');
    if(riep) riep.textContent = e.target.value || 'Senza nome';
  }));
  wrap.querySelectorAll('.dweekday').forEach(sel=>sel.addEventListener('change', e=>{ editingDays[e.target.dataset.di].weekday = e.target.value; aggiornaRiepilogoGiorno(e.target.dataset.di); }));
  wrap.querySelectorAll('.dcategoria').forEach(sel=>sel.addEventListener('change', e=>{ editingDays[e.target.dataset.di].categoria = e.target.value || null; }));
  wrap.querySelectorAll('[data-action="remove-day"]').forEach(btn=>btn.addEventListener('click', e=>{
    customConfirm("Rimuovere questo giorno dalla nuova scheda?", ()=>{ editingDays.splice(e.target.dataset.di,1); renderDayEditors(); });
  }));
  wireEsclusivitaGiorni();
  wrap.querySelectorAll('[data-action="pick-ex"]').forEach(btn=>btn.addEventListener('click', e=>{
    const di = e.target.dataset.di;
    openMusclePicker("Aggiungi esercizio al giorno " + editingDays[di].key, (ex)=>{
      editingDays[di].exercises.push({name: ex.n, sets: 3, reps: ex.tempo ? "30-45 sec" : "10", muscles: [ex.g], recupero: null});
      renderExerciseEditors(di);
      aggiornaRiepilogoGiorno(di);
    });
  }));
  wrap.querySelectorAll('[data-action="add-ex"]').forEach(btn=>btn.addEventListener('click', e=>{
    const di = e.target.dataset.di;
    editingDays[di].exercises.push({name:"", sets:3, reps:"10", muscles:[], recupero: null});
    renderExerciseEditors(di);
    aggiornaRiepilogoGiorno(di);
  }));
}
// Tabella "serie principale + tappe" nell'editor scheda:
// - dropset: ogni tappa riduce il peso di una percentuale rispetto alla tappa precedente
// - rest-pause: stesso peso, solo una brevissima pausa tra una tappa e l'altra
function dropsetEditorHtml(di, ei, ex){
  const tipo = ex.dropset.tipo || 'dropset';
  const drops = (ex.dropset && ex.dropset.drops) || [];
  const opzioniRiduzione = [10,15,20,25,30,35,40,50];
  const nomeTappa = tipo==='restpause' ? 'Rest-pause' : 'Drop';
  return `
    <div class="dropset-box">
      <div class="dropset-stage">
        <div class="dropset-num">1</div>
        <div class="dropset-body">
          <div class="dropset-label">Serie principale</div>
          <div class="dropset-fields">
            <span class="dropset-val">${ex.sets || 0} serie × ${escapeAttr(ex.reps||'')} rip.</span>
          </div>
        </div>
      </div>
      ${drops.map((d,dj)=>`
        <div class="dropset-stage">
          <div class="dropset-num">${dj+2}</div>
          <div class="dropset-body">
            <div class="dropset-label">${nomeTappa} ${dj+1}</div>
            <div class="dropset-fields">
              <input type="number" class="small dropset-reps" placeholder="rip." value="${escapeAttr(d.reps!=null?d.reps:'')}" data-di="${di}" data-ei="${ei}" data-dj="${dj}">
              ${tipo==='restpause'
                ? `<span class="dropset-val" style="flex:1;">stesso peso, pausa breve</span>`
                : `<select class="dropset-riduzione" data-di="${di}" data-ei="${ei}" data-dj="${dj}">
                     ${opzioniRiduzione.map(p=>`<option value="${p}" ${d.riduzione===p?'selected':''}>-${p}%</option>`).join('')}
                   </select>`}
              <button type="button" class="dropset-remove" data-di="${di}" data-ei="${ei}" data-dj="${dj}">×</button>
            </div>
          </div>
        </div>`).join('')}
      <button type="button" class="btn ghost block dropset-add" data-di="${di}" data-ei="${ei}" style="margin-top:2px;">+ Aggiungi ${nomeTappa.toLowerCase()}</button>
      <p class="hint" style="margin:8px 0 0;">${tipo==='restpause'
        ? 'Le tappe successive si eseguono con una pausa di 10-15 secondi, allo stesso peso, per allungare la serie.'
        : "Le tappe successive vengono eseguite senza pausa dopo la serie principale, riducendo il peso della percentuale indicata rispetto alla tappa precedente."}</p>
    </div>`;
}

// Collega questo esercizio a un altro dello stesso giorno: si eseguono una serie
// dell'uno e subito una dell'altro, senza pausa. Il collegamento è reciproco.
function supersetEditorHtml(di, ei, ex, day){
  const altri = day.exercises.map((e,idx)=>({idx, nome:e.name})).filter(o=>o.idx!=ei && o.nome);
  if(altri.length===0){
    return `<div class="dropset-box"><p class="hint" style="margin:0;">Aggiungi un altro esercizio a questo giorno per poterlo collegare in superset.</p></div>`;
  }
  const scelto = altri.find(o=>String(o.idx)===String(ex.supersetCon));
  return `
    <div class="dropset-box">
      <label style="margin-top:0;">Esercizio abbinato</label>
      <select class="superset-select" data-di="${di}" data-ei="${ei}">
        ${altri.map(o=>`<option value="${o.idx}" ${String(o.idx)===String(ex.supersetCon)?'selected':''}>${escapeAttr(o.nome)}</option>`).join('')}
      </select>
      <p class="hint" style="margin-top:8px;">Farai una serie di questo esercizio, poi subito una di <b>${escapeAttr(scelto?scelto.nome:'quello abbinato')}</b>, senza pausa tra i due — poi riposo, e si ripete.</p>
    </div>`;
}

function renderExerciseEditors(di){
  const list = document.querySelector(`.ex-list[data-di="${di}"]`);
  const day = editingDays[di];
  const lp = activeProfile();
  // solo la libreria: i vecchi nomi restano riconosciuti nelle schede già fatte,
  // ma non vengono più proposti, altrimenti compaiono doppioni tipo
  // "Curl su panca inclinata" e "curl panca inclinata"
  const baseNames = EX_LIB.map(e=>e.n.toLowerCase()).sort();
  const personalNames = Object.keys((lp && lp.customExercises) || {}).sort();

  function exOptionsHtml(selected){
    const sel = (selected||'').trim().toLowerCase();
    let html = `<option value="" ${!sel?'selected':''} disabled>— scegli esercizio —</option>`;
    html += `<option value="__crea__">+ Crea nuovo esercizio…</option>`;
    if(personalNames.length>0){
      html += `<optgroup label="I tuoi esercizi">`;
      html += personalNames.map(n=>`<option value="${escapeAttr(toTitleCase(n))}" ${n===sel?'selected':''}>${toTitleCase(n)}</option>`).join('');
      html += `</optgroup>`;
    }
    html += `<optgroup label="Esercizi di base">`;
    html += baseNames.map(n=>`<option value="${escapeAttr(toTitleCase(n))}" ${n===sel?'selected':''}>${toTitleCase(n)}</option>`).join('');
    html += `</optgroup>`;
    // se il valore salvato non e' tra quelli disponibili (es. importato da PDF/testo libero), lo aggiungo comunque per non perderlo
    if(sel && !baseNames.includes(sel) && !personalNames.includes(sel)){
      html += `<option value="${escapeAttr(selected)}" selected>${escapeAttr(selected)} (non riconosciuto)</option>`;
    }
    return html;
  }

  function riassuntoTecnica(ex){
    if(ex.dropset) return ex.dropset.tipo==='restpause' ? 'Rest-pause' : 'Dropset';
    if(ex.supersetCon!=null) return 'Superset';
    return 'Nessuna';
  }
  function riassuntoMuscoli(ex){
    const m = ex.muscles || [];
    return m.length ? m.join(', ') : 'nessuno';
  }

  list.innerHTML = day.exercises.map((ex,ei)=>{
    const eiNum = parseInt(ei);
    const partnerIdx = ex.supersetCon!=null ? ex.supersetCon : chiMiHaAbbinato(day, eiNum);
    const partnerEx = (partnerIdx!=null && partnerIdx>=0) ? day.exercises[partnerIdx] : null;
    const chipSuperset = partnerEx ? `<div class="superset-chip">⚡ Superset con ${escapeAttr(partnerEx.name || '(esercizio '+(parseInt(partnerIdx)+1)+')')}</div>` : '';
    const tecnicaAttiva = riassuntoTecnica(ex);
    return `
    <div class="exercise-edit-block" data-di="${di}" data-ei="${ei}">
      <div class="exercise-edit-top">
        <div class="exercise-edit-num">${eiNum+1}</div>
        <select class="ex-name-input" data-di="${di}" data-ei="${ei}" data-field="name">
          ${exOptionsHtml(ex.name)}
        </select>
        <button type="button" class="remove-x" data-di="${di}" data-ei="${ei}" aria-label="Rimuovi esercizio">×</button>
      </div>
      ${chipSuperset}
      <div class="exercise-edit-row">
        <div class="ex-field"><span class="ex-field-label">Serie</span><input type="number" class="small" placeholder="serie" value="${ex.sets}" data-di="${di}" data-ei="${ei}" data-field="sets"></div>
        <div class="ex-field"><span class="ex-field-label">Rip.</span><input type="text" class="small" placeholder="rip." value="${escapeAttr(ex.reps)}" data-di="${di}" data-ei="${ei}" data-field="reps"></div>
        <div class="ex-field"><span class="ex-field-label">Rec. (s)</span><input type="number" class="small rec" placeholder="facolt." title="Recupero in secondi (facoltativo)" min="0" step="5" value="${ex.recupero!=null?ex.recupero:''}" data-di="${di}" data-ei="${ei}" data-field="recupero"></div>
      </div>
      <input type="text" class="ex-note-input" placeholder="Nota per l'allenamento (facoltativa) — es. presa larga, attenzione alla spalla…" value="${escapeAttr(ex.note||'')}" data-di="${di}" data-ei="${ei}" data-field="note">
      <details class="ex-sub-details">
        <summary><span class="ex-sub-titolo">Muscoli coinvolti</span><span class="ex-sub-riassunto">${escapeAttr(riassuntoMuscoli(ex))}</span></summary>
        <div class="muscle-chip-group" data-di="${di}" data-ei="${ei}">
          ${MUSCLE_GROUPS.map(m=>`<div class="muscle-chip ${(ex.muscles||[]).includes(m)?'selected':''}" data-m="${m}">${m}</div>`).join('')}
        </div>
      </details>
      <details class="ex-sub-details" ${tecnicaAttiva!=='Nessuna' ? 'open' : ''}>
        <summary><span class="ex-sub-titolo">Tecnica speciale</span><span class="ex-sub-riassunto">${tecnicaAttiva}</span></summary>
        <div class="seg-toggle seg-toggle-tecnica">
          <button type="button" class="seg-btn ${!ex.dropset && ex.supersetCon==null?'active':''}" data-di="${di}" data-ei="${ei}" data-tecnica="nessuna">Nessuna</button>
          <button type="button" class="seg-btn ${ex.dropset && ex.dropset.tipo==='dropset'?'active':''}" data-di="${di}" data-ei="${ei}" data-tecnica="dropset">Dropset</button>
          <button type="button" class="seg-btn ${ex.dropset && ex.dropset.tipo==='restpause'?'active':''}" data-di="${di}" data-ei="${ei}" data-tecnica="restpause">Rest-pause</button>
          <button type="button" class="seg-btn ${ex.supersetCon!=null?'active':''}" data-di="${di}" data-ei="${ei}" data-tecnica="superset">Superset</button>
        </div>
        ${ex.dropset ? dropsetEditorHtml(di, ei, ex) : ''}
        ${ex.supersetCon!=null ? supersetEditorHtml(di, ei, ex, day) : ''}
      </details>
    </div>`;
  }).join('');

  list.querySelectorAll('.ex-name-input').forEach(sel=>{
    sel.addEventListener('change', e=>{
      const {di, ei} = e.target.dataset;
      if(e.target.value === '__crea__'){
        apriCreaEsercizio('', (ex)=>{
          editingDays[di].exercises[ei].name = ex.n;
          const match = getExerciseMuscles(ex.n);
          editingDays[di].exercises[ei].muscles = match ? [...match] : [ex.g];
          renderExerciseEditors(di);
        });
        renderExerciseEditors(di); // se annulla, la tendina torna al nome che c'era prima
        return;
      }
      editingDays[di].exercises[ei].name = e.target.value;
      const match = getExerciseMuscles(e.target.value);
      if(match) editingDays[di].exercises[ei].muscles = [...match];
      renderExerciseEditors(di); // ridisegna per mostrare i chip aggiornati
    });
  });
  list.querySelectorAll('.exercise-edit-row input:not(.ex-name-input)').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const {di, ei, field} = e.target.dataset;
      const ex = editingDays[di].exercises[ei];
      if(field==='sets') ex[field] = parseInt(e.target.value)||0;
      else if(field==='recupero') ex[field] = e.target.value==='' ? null : (parseInt(e.target.value)||0);
      else ex[field] = e.target.value;
      // aggiorno solo il testo "serie principale" della tabella dropset, senza
      // ridisegnare tutto: altrimenti perderesti il focus mentre stai scrivendo
      if((field==='reps'||field==='sets') && ex.dropset){
        const val = e.target.closest('.exercise-edit-block').querySelector('.dropset-val');
        if(val) val.textContent = `${ex.sets || 0} serie × ${ex.reps||''} rip.`;
      }
    });
  });
  list.querySelectorAll('.ex-note-input').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const {di, ei} = e.target.dataset;
      editingDays[di].exercises[ei].note = e.target.value;
    });
  });
  list.querySelectorAll('.seg-toggle-tecnica .seg-btn').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const {di, ei, tecnica} = e.target.dataset;
      const giorno = editingDays[di];
      const ex = giorno.exercises[ei];
      scollegaSuperset(giorno, parseInt(ei));   // parto sempre pulito: stacco un eventuale superset esistente
      delete ex.dropset;
      if(tecnica === 'dropset'){
        ex.dropset = { tipo:'dropset', drops: [{ reps: '8', riduzione: 25 }] };
      } else if(tecnica === 'restpause'){
        ex.dropset = { tipo:'restpause', drops: [{ reps: '6', riduzione: 0 }] };
      } else if(tecnica === 'superset'){
        // di default abbino l'esercizio subito dopo (o, se è l'ultimo, quello subito
        // prima): è l'abbinamento più naturale, non sempre il primo della lista
        const idx = parseInt(ei);
        const valido = (i) => i>=0 && i<giorno.exercises.length && i!==idx && giorno.exercises[i].name;
        let partner = null;
        if(valido(idx+1)) partner = idx+1;
        else if(valido(idx-1)) partner = idx-1;
        else {
          const altri = giorno.exercises.map((e2,i)=>i).filter(valido);
          if(altri.length>0) partner = altri[0];
        }
        if(partner!=null) collegaSuperset(giorno, idx, partner);
      }
      renderExerciseEditors(di);
    });
  });
  list.querySelectorAll('.dropset-add').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const {di, ei} = e.target.dataset;
      const tipo = editingDays[di].exercises[ei].dropset.tipo;
      editingDays[di].exercises[ei].dropset.drops.push({ reps: tipo==='restpause'?'6':'8', riduzione: tipo==='restpause'?0:25 });
      renderExerciseEditors(di);
    });
  });
  list.querySelectorAll('.dropset-remove').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const {di, ei, dj} = e.target.dataset;
      const ex = editingDays[di].exercises[ei];
      ex.dropset.drops.splice(dj,1);
      if(ex.dropset.drops.length===0) delete ex.dropset;
      renderExerciseEditors(di);
    });
  });
  list.querySelectorAll('.dropset-reps').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const {di, ei, dj} = e.target.dataset;
      editingDays[di].exercises[ei].dropset.drops[dj].reps = e.target.value;
    });
  });
  list.querySelectorAll('.dropset-riduzione').forEach(sel=>{
    sel.addEventListener('change', e=>{
      const {di, ei, dj} = e.target.dataset;
      editingDays[di].exercises[ei].dropset.drops[dj].riduzione = parseInt(e.target.value)||0;
    });
  });
  list.querySelectorAll('.superset-select').forEach(sel=>{
    sel.addEventListener('change', e=>{
      const {di, ei} = e.target.dataset;
      collegaSuperset(editingDays[di], parseInt(ei), parseInt(e.target.value));
      renderExerciseEditors(di);
    });
  });
  list.querySelectorAll('.remove-x').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const {di, ei} = e.target.dataset;
      const giorno = editingDays[di];
      const idx = parseInt(ei);
      // chi era abbinato in superset a questo esercizio si scollega, e gli indici
      // di chi viene dopo si correggono per via dello slittamento nell'array
      giorno.exercises.forEach(ex=>{
        if(ex.supersetCon == null) return;
        if(ex.supersetCon === idx) delete ex.supersetCon;
        else if(ex.supersetCon > idx) ex.supersetCon--;
      });
      giorno.exercises.splice(idx,1);
      renderExerciseEditors(di);
      aggiornaRiepilogoGiorno(di);
    });
  });
  list.querySelectorAll('.muscle-chip-group').forEach(group=>{
    group.querySelectorAll('.muscle-chip').forEach(chip=>{
      chip.addEventListener('click', ()=>{
        const {di, ei} = group.dataset;
        const ex = editingDays[di].exercises[ei];
        if(!ex.muscles) ex.muscles = [];
        const m = chip.dataset.m;
        if(ex.muscles.includes(m)) ex.muscles = ex.muscles.filter(x=>x!==m);
        else ex.muscles.push(m);
        chip.classList.toggle('selected');
        // niente re-render completo (si perderebbe lo stato aperto/chiuso
        // della tendina): aggiorno solo il riassunto nel summary
        const riassunto = group.closest('.ex-sub-details')?.querySelector('.ex-sub-riassunto');
        if(riassunto) riassunto.textContent = ex.muscles.length ? ex.muscles.join(', ') : 'nessuno';
      });
    });
  });
}
document.getElementById('clearFormBtn').addEventListener('click', ()=>{
  const etichettaSalva = document.getElementById('saveNewProgramBtn').style.display!=='none' && document.getElementById('updateProgramBtn').style.display==='none'
    ? document.getElementById('saveNewProgramBtn').textContent
    : 'Aggiorna scheda';
  customConfirm(`Svuotare i giorni di allenamento? (la scheda attualmente attiva non viene toccata finché non premi "${etichettaSalva}")`, ()=>{
    editingDays = [];
    document.getElementById('newProgramName').value = "";
    renderDayEditors();
    toast("Modulo svuotato — compila da zero");
  });
});

// ---- header compatto di Scheda: matita (Vedi → Modifica), freccia indietro
// (Modifica → Vedi) e "+ Nuova scheda" — pilotano lo stesso motore di sempre
// (.seg-btn[data-seg], nascosto ma invariato: vedi #progVedModToggle) ----
// Ognuno fissa anche _modoEditorScheda, così l'editor mostra un solo bottone
// di salvataggio alla volta invece di entrambi assieme (26/08/2026).
document.getElementById('schedaEditBtn').addEventListener('click', ()=>{
  _modoEditorScheda = 'modifica';
  aggiornaModalitaEditorScheda();
  document.querySelector('.seg-btn[data-seg="edit"]').click();
});
document.getElementById('schedaTornaVediBtn').addEventListener('click', ()=>{
  _modoEditorScheda = 'modifica';   // si esce dall'editor: la prossima apertura riparte da "modifica"
  document.querySelector('.seg-btn[data-seg="view"]').click();
});
document.getElementById('nuovaSchedaBtn').addEventListener('click', ()=>{
  customConfirm("Iniziare una scheda nuova da zero? La scheda attuale resta invariata finché non premi \"Salva scheda\".", ()=>{
    editingDays = [];
    document.getElementById('newProgramName').value = "";
    document.getElementById('newProgramDurata').value = "";
    document.getElementById('newProgramNotePT').value = "";
    _modoEditorScheda = 'nuova';
    aggiornaModalitaEditorScheda();
    renderDayEditors();
    document.querySelector('.seg-btn[data-seg="edit"]').click();
    toast("Scheda nuova — aggiungi il primo giorno");
  });
});

// ---- header compatto di Dieta: stessa coppia matita/freccia di Scheda
// qui sopra (31/08/2026, richiesta esplicita) — pilotano lo stesso motore
// di sempre (.seg-btn[data-segd], nascosto ma invariato: vedi
// #dietPlanVedModToggle), così anche l'apertura automatica della tendina
// "Piano alimentare assegnato dal PT" (gestita da quel motore) resta invariata. ----
document.getElementById('dietEditBtn').addEventListener('click', ()=>{
  document.querySelector('.seg-btn[data-segd="edit"]').click();
});
document.getElementById('dietTornaVediBtn').addEventListener('click', ()=>{
  document.querySelector('.seg-btn[data-segd="view"]').click();
});

document.getElementById('clearDietFormBtn').addEventListener('click', ()=>{
  customConfirm("Svuotare il piano alimentare? (la dieta attualmente attiva non viene toccata finché non premi \"Salva dieta\")", ()=>{
    editingDietInfo = {peso:"",altezza:"",attivita:"",calorie:"",macro:"",esclusi:"",noteIntolleranza:""};
    editingDiet = blankDietDays();
    renderDietInfoEditors();
    renderDietDayEditors();
    toast("Piano alimentare svuotato — compila da zero");
  });
});

document.getElementById('addDayBtn').addEventListener('click', ()=>{
  const usedKeys = editingDays.map(d=>d.key);
  const letters = "ABCDEFGH";
  let nextKey = "A";
  for(const l of letters){ if(!usedKeys.includes(l)){ nextKey=l; break; } }
  editingDays.push({key:nextKey, name:"Nuovo giorno", weekday:"Lunedì", categoria:null, exercises:[]});
  renderDayEditors();
  // il giorno appena aggiunto si apre da solo, pronto per essere compilato
  // (coerente con "un giorno alla volta": non serve cercarlo tra gli altri)
  const nuovo = document.querySelector(`.day-accordion[data-di="${editingDays.length-1}"]`);
  if(nuovo){ nuovo.open = true; if(nuovo.scrollIntoView) nuovo.scrollIntoView({behavior:'smooth', block:'start'}); }
});

// ---- editor info dieta ----
function renderDietInfoEditors(){
  const wrap = document.getElementById('dietInfoEditors');
  const fields = [
    ["peso","Peso attuale"], ["altezza","Altezza"], ["attivita","Attività fisica"],
    ["calorie","Calorie giornaliere target"], ["macro","Macronutrienti"],
    ["esclusi","Alimenti esclusi"], ["noteIntolleranza","Note (es. intolleranze)"]
  ];
  wrap.innerHTML = fields.map(([key,label])=>`
    <div class="field">
      <label>${label}</label>
      <input type="text" data-key="${key}" value="${escapeAttr(editingDietInfo[key]||'')}">
    </div>`).join('');
  wrap.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('input', e=>{ editingDietInfo[e.target.dataset.key] = e.target.value; });
  });
}

// ---- editor dieta per giorno ----
function renderDietDayEditors(){
  const wrap = document.getElementById('dietDayEditors');
  wrap.innerHTML = WD_ORDER.map(wd=>{
    const day = editingDiet[wd] || {libera:false, colazione:"",pranzo:"",spuntino:"",cena:""};
    return `
    <div class="day-editor${wd==='Domenica'?' full-width-card':''}" data-wd="${wd}">
      <div class="day-editor-head"><div style="font-family:var(--font-display); font-size:14px; color:var(--diet);">${wd}</div></div>
      <div class="checkbox-row">
        <input type="checkbox" class="libera-check" data-wd="${wd}" ${day.libera?'checked':''}>
        <label>Giorno libero / sgarro</label>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" class="palestra-check" data-wd="${wd}" ${day.palestra?'checked':''}>
        <label>Giorno palestra</label>
      </div>
      <div class="normal-fields" data-wd="${wd}" style="display:${day.libera?'none':'block'};">
        <label>Colazione</label>
        <input type="text" class="dfield" data-wd="${wd}" data-field="colazione" value="${escapeAttr(day.colazione)}">
        <label>Pranzo</label>
        <input type="text" class="dfield" data-wd="${wd}" data-field="pranzo" value="${escapeAttr(day.pranzo)}">
        <label>Spuntino</label>
        <input type="text" class="dfield" data-wd="${wd}" data-field="spuntino" value="${escapeAttr(day.spuntino)}">
        <label>Cena</label>
        <input type="text" class="dfield" data-wd="${wd}" data-field="cena" value="${escapeAttr(day.cena)}">
      </div>
      <div class="free-fields" data-wd="${wd}" style="display:${day.libera?'block':'none'};">
        <label>Note giorno libero</label>
        <textarea class="dfree" data-wd="${wd}">${day.testo||''}</textarea>
      </div>
    </div>`;
  }).join('');

  wrap.querySelectorAll('.libera-check').forEach(chk=>{
    chk.addEventListener('change', e=>{
      const wd = e.target.dataset.wd;
      if(!editingDiet[wd]) editingDiet[wd] = {};
      editingDiet[wd].libera = e.target.checked;
      wrap.querySelector(`.normal-fields[data-wd="${wd}"]`).style.display = e.target.checked ? 'none':'block';
      wrap.querySelector(`.free-fields[data-wd="${wd}"]`).style.display = e.target.checked ? 'block':'none';
    });
  });
  wrap.querySelectorAll('.palestra-check').forEach(chk=>{
    chk.addEventListener('change', e=>{
      const wd = e.target.dataset.wd;
      if(!editingDiet[wd]) editingDiet[wd] = {};
      editingDiet[wd].palestra = e.target.checked;
    });
  });
  wrap.querySelectorAll('.dfield').forEach(inp=>{
    inp.addEventListener('input', e=>{
      const wd = e.target.dataset.wd;
      if(!editingDiet[wd]) editingDiet[wd] = {libera:false};
      editingDiet[wd][e.target.dataset.field] = e.target.value;
    });
  });
  wrap.querySelectorAll('.dfree').forEach(ta=>{
    ta.addEventListener('input', e=>{
      const wd = e.target.dataset.wd;
      if(!editingDiet[wd]) editingDiet[wd] = {libera:true};
      editingDiet[wd].testo = e.target.value;
    });
  });
}

// ---- salvataggio nuovo programma ----
// 31/08/2026: la data di inizio non si scrive più a mano (vedi il commento
// sopra il campo Durata) — resta quella già impostata se c'era, altrimenti
// parte da quando la scheda è stata creata; la scadenza si ricalcola sempre
// da qui + la durata appena salvata.
function calcolaScadenzaScheda(dataInizioIso, durataSettimane){
  if(!dataInizioIso || !durataSettimane) return null;
  const d = new Date(dataInizioIso + 'T00:00:00');
  d.setDate(d.getDate() + durataSettimane*7);
  return d.toISOString().slice(0,10);
}
document.getElementById('updateProgramBtn').addEventListener('click', ()=>{
  if(editingDays.length===0){ toast("Aggiungi almeno un giorno di allenamento."); return; }
  const current = activeProgram();
  current.days = editingDays;
  current.durataSettimane = parseInt(document.getElementById('newProgramDurata').value) || null;
  if(!current.dataInizio) current.dataInizio = current.createdAt || new Date().toISOString().slice(0,10);
  current.scadenza = calcolaScadenzaScheda(current.dataInizio, current.durataSettimane);
  current.notePT = document.getElementById('newProgramNotePT').value.trim() || null;
  propagaEserciziPersonalizzatiPT(editingDays);
  segnaModifica(activeProfile(), 'scheda');
  save();
  toast("Scheda aggiornata ✓");
  renderHeader(); renderDayChoices(); renderNewProgramForm(); renderProgramView();
  // 31/08/2026 (quarto giro, segnalato con screenshot): il tasto sotto
  // cambiava solo la voce di nav attiva, non usciva davvero da "Modifica
  // scheda" — restava sull'editor invece di tornare a vedere la scheda
  // appena salvata. Stesso passaggio già usato da #schedaTornaVediBtn.
  document.querySelector('.seg-btn[data-seg="view"]').click();
  document.querySelector('.tab-btn[data-tab="program"]').click();
});

document.getElementById('saveNewProgramBtn').addEventListener('click', ()=>{
  if(editingDays.length===0){ toast("Aggiungi almeno un giorno di allenamento."); return; }
  const prof = activeProfile();
  const name = document.getElementById('newProgramName').value.trim() || ("Scheda del " + formatDate(new Date().toISOString().slice(0,10)));
  const today = new Date().toISOString().slice(0,10);

  const current = activeProgram();
  if(programmaVuoto(current)){
    prof.programs = prof.programs.filter(p=>p.id!==current.id);
  } else {
    current.archivedAt = today;
  }

  const durataSettimaneNuova = parseInt(document.getElementById('newProgramDurata').value) || null;
  const newProgram = {
    id: uid(), name, createdAt: today, archivedAt: null,
    durataSettimane: durataSettimaneNuova,
    dataInizio: today,
    scadenza: calcolaScadenzaScheda(today, durataSettimaneNuova),
    notePT: document.getElementById('newProgramNotePT').value.trim() || null,
    days: editingDays, dietInfo: current.dietInfo, diet: current.diet
  };
  prof.programs.push(newProgram);
  prof.activeProgramId = newProgram.id;
  propagaEserciziPersonalizzatiPT(editingDays);
  segnaModifica(prof, 'scheda');
  save();
  toast("Scheda attivata ✓");
  renderHeader(); renderDayChoices(); renderNewProgramForm(); renderProgramView();
  // 31/08/2026 (quarto giro): stesso motivo del tasto "Aggiorna scheda" qui
  // sopra — esce davvero dall'editor invece di limitarsi a evidenziare la
  // voce di nav.
  document.querySelector('.seg-btn[data-seg="view"]').click();
  document.querySelector('.tab-btn[data-tab="program"]').click();
});

document.getElementById('saveDietBtn').addEventListener('click', ()=>{
  const prof = activeProfile();
  const today = new Date().toISOString().slice(0,10);

  const current = activeProgram();
  if(programmaVuoto(current)){
    prof.programs = prof.programs.filter(p=>p.id!==current.id);
  } else {
    current.archivedAt = today;
  }

  const newProgram = {
    id: uid(), name: current.name, createdAt: today, archivedAt: null, scadenza: current.scadenza || null,
    days: current.days, dietInfo: editingDietInfo, diet: editingDiet
  };
  prof.programs.push(newProgram);
  prof.activeProgramId = newProgram.id;
  segnaModifica(prof, 'dieta');
  save();
  toast("Dieta aggiornata ✓");
  renderHeader(); renderDayChoices(); renderDietEditForm(); renderDietPlanView(); renderArchiveList();
  // 31/08/2026: stesso passaggio già usato da updateProgramBtn/saveNewProgramBtn
  // in Scheda qui sopra — esce davvero da "Modifica" invece di restarci con
  // la dieta appena salvata sotto agli occhi ancora in modalità editor.
  document.querySelector('.seg-btn[data-segd="view"]').click();
  document.querySelector('.tab-btn[data-tab="diet"]').click();
});

function renderProgramDetailHtml(p){
  // Sezioni separate e chiaramente etichettate per allenamento e dieta
  // (26/08, ventunesimo giro — prima erano un unico blocco senza titoli,
  // difficile da distinguere a colpo d'occhio; ognuna dice esplicitamente
  // se non c'è nulla di compilato, invece di restare vuota o piena di "-").
  const haGiorni = giorniCompilati(p.days);
  const daysHtml = !haGiorni ? '' : p.days.map(d=>`
    <div class="day-editor">
      <div class="day-editor-head">
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="letter">${d.key}</div>
          <div class="day-name-block">
            <div class="dname">${d.name}</div>
            <div class="hint">${d.weekday}</div>
          </div>
        </div>
      </div>
      ${d.exercises.map(ex=>{
        const vi = getExerciseVideoInfo(ex.name);
        return `<div class="hint">• ${ex.name} — ${ex.sets}×${ex.reps}${etichettaTecnica(ex,d)} <a href="${escapeAttr(vi.url)}" data-ex-name="${escapeAttr(ex.name)}" class="video-link">▶</a></div>
          ${ex.note ? `<div class="exercise-note" style="margin:2px 0 6px 14px;">📌 ${escapeAttr(ex.note)}</div>` : ''}`;
      }).join('')}
    </div>`).join('');

  const haDieta = dietaCompilata(p.diet);
  const dietHtml = !haDieta ? '' : WD_ORDER.map(wd=>{
    const day = p.diet[wd];
    if(!day) return "";
    if(day.libera) return `<div class="diet-day-card"><div class="diet-day-head"><span class="wd">${wd}</span><span class="diet-free-badge">Libero</span></div><div class="diet-meal-row">${day.testo||''}</div></div>`;
    return `<div class="diet-day-card"><div class="diet-day-head"><span class="wd">${wd}</span></div>
      <div class="diet-meal-row"><b>Colazione</b>${day.colazione||'-'}</div>
      <div class="diet-meal-row"><b>Pranzo</b>${day.pranzo||'-'}</div>
      <div class="diet-meal-row"><b>Spuntino</b>${day.spuntino||'-'}</div>
      <div class="diet-meal-row"><b>Cena</b>${day.cena||'-'}</div></div>`;
  }).join('');

  return `
    <div class="archive-detail-sez">
      <div class="archive-detail-titolo">🏋️ Allenamento</div>
      ${haGiorni ? daysHtml : '<div class="archive-detail-vuoto">Nessun allenamento salvato in questa versione.</div>'}
    </div>
    <div class="archive-detail-sez" style="margin-top:14px;">
      <div class="archive-detail-titolo">🥗 Dieta</div>
      ${haDieta ? dietHtml : '<div class="archive-detail-vuoto">Nessuna dieta compilata in questa versione.</div>'}
    </div>`;
}

// ============================================================
