// SCHEDA + DIETA (VIEW)
// ============================================================
function renderProgramView(){
  renderSchedaView();
  renderDietPlanView();
}
// Scheda in sola lettura, stile compatto (25/08/2026, diciottesimo giro):
// card con i dati veri del programma (durata/data inizio/progresso settimane
// solo se impostati entrambi, PT se presente) + giorni come <details> — quello
// di oggi (o il primo, se oggi non si allena) aperto, gli altri riassunti a
// "nome · N esercizi". Nessun numero inventato: durata/inizio/PT compaiono
// solo se qualcuno li ha davvero impostati (vedi editor più sotto).
function renderSchedaView(){
  document.getElementById('programViewCard').style.display = 'block';
  document.getElementById('programViewHiddenCard').style.display = 'none';

  const p = activeProgram();
  const wrap = document.getElementById('programView');
  if(!p){ wrap.innerHTML = ''; return; }
  const oggiWd = WEEKDAYS[new Date().getDay()];

  let settimanaHtml = '';
  if(p.durataSettimane && p.dataInizio){
    const ms = Date.now() - new Date(p.dataInizio+'T00:00:00').getTime();
    let corrente = Math.floor(ms / 604800000) + 1;
    if(corrente < 1) corrente = 1;
    if(corrente > p.durataSettimane) corrente = p.durataSettimane;
    const pct = Math.min(100, Math.round(corrente / p.durataSettimane * 100));
    settimanaHtml = `
      <div class="scheda-settimana-row">
        <div class="scheda-settimana-testo"><span>Settimana ${corrente} di ${p.durataSettimane}</span><span>${pct}%</span></div>
        <div class="scheda-progress-bar"><div class="scheda-progress-fill" style="width:${pct}%;"></div></div>
      </div>`;
  }
  const statVoci = [];
  if(p.durataSettimane) statVoci.push(['Durata', `${p.durataSettimane} settiman${p.durataSettimane===1?'a':'e'}`]);
  statVoci.push(['Giorni/settimana', `${p.days.length}`]);
  if(p.dataInizio) statVoci.push(['Inizio', formatDate(p.dataInizio)]);
  const statiHtml = `<div class="riepilogo-grid">${statVoci.map(([lab,val])=>`
    <div class="riepilogo-stat"><span class="riepilogo-label">${lab.toUpperCase()}</span><span class="riepilogo-val">${val}</span></div>`).join('')}</div>`;

  const infoCardHtml = `
    <div class="card scheda-info-card">
      <div class="scheda-info-top">
        <h3 class="scheda-info-nome">${p.name}</h3>
        <span class="scheda-badge-attivo">ATTIVO</span>
      </div>
      ${settimanaHtml}
      ${statiHtml}
    </div>`;

  const idxOggi = p.days.findIndex(d=>d.weekday===oggiWd);
  const idxAperto = idxOggi >= 0 ? idxOggi : 0;
  const giorniHtml = p.days.map((d,i)=>{
    const eOggi = d.weekday === oggiWd;
    const cat = d.categoria && CATEGORIE_ALLENAMENTO[d.categoria];
    const nEx = d.exercises.length;
    return `
    <details class="day-editor day-view-accordion"${i===idxAperto ? ' open' : ''}>
      <summary>
        <div class="letter">${d.key}</div>
        <div class="day-name-block">
          <div class="dname-riepilogo">${d.name}</div>
          <div class="hint">${d.weekday}${eOggi ? ' · oggi' : ''} · ${nEx} esercizi${nEx===1?'o':''}</div>
        </div>
        ${cat ? `<span class="workout-tag ${cat.classe}">${cat.label}</span>` : ''}
        <span class="day-accordion-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span>
      </summary>
      <div class="day-view-body">
        ${eOggi ? `<button type="button" class="btn block" onclick="apriRegistra()">Registra questo allenamento</button>` : ''}
        ${d.exercises.map((ex,ei)=>{
          const vi = getExerciseVideoInfo(ex.name);
          return `<div class="day-view-ex">
            <div class="day-view-ex-nome"><span class="day-view-ex-num">${ei+1}</span>${ex.name}${etichettaTecnica(ex,d)}</div>
            <div class="day-view-ex-stats">
              <span>${ex.sets}×${ex.reps}</span>
              ${ex.recupero ? `<span>⏱ ${ex.recupero}s recupero</span>` : ''}
              <a href="${escapeAttr(vi.url)}" data-ex-name="${escapeAttr(ex.name)}" class="video-link">▶ video</a>
            </div>
            ${ex.note ? `<div class="day-view-ex-note exercise-note">📌 ${ex.note}</div>` : ''}
          </div>`;
        }).join('') || '<div class="empty">Nessun esercizio in questo giorno.</div>'}
      </div>
    </details>`;
  }).join('');

  const noteHtml = p.notePT ? `
    <div class="card scheda-note-pt-card">
      <h4>Note del PT</h4>
      <p>${p.notePT}</p>
    </div>` : '';

  wrap.innerHTML = infoCardHtml + giorniHtml + noteHtml;
}
function renderDietPlanView(){
  document.getElementById('dietViewCard').style.display = 'block';
  document.getElementById('dietViewHiddenCard').style.display = 'none';

  const p = activeProgram();
  const info = p.dietInfo || {};
  const infoLines = [
    ["Peso", info.peso], ["Altezza", info.altezza], ["Attività fisica", info.attivita],
    ["Calorie", info.calorie], ["Macronutrienti", info.macro],
    ["Alimenti esclusi", info.esclusi], ["Note", info.noteIntolleranza]
  ].filter(x=>x[1]);
  document.getElementById('dietInfoView').innerHTML = infoLines.map(x=>`• <b style="color:var(--text-dim); font-weight:600;">${x[0]}:</b> ${x[1]}`).join('<br>');

  const dietWrap = document.getElementById('dietView');
  const diet = p.diet;
  if(!diet || typeof diet === 'string'){
    dietWrap.innerHTML = diet ? `<div class="hint" style="white-space:pre-wrap;">${diet}</div>` : '<div class="empty">Nessun piano alimentare salvato.</div>';
    return;
  }
  dietWrap.innerHTML = WD_ORDER.map(wd=>{
    const day = diet[wd];
    if(!day) return "";
    const isGym = (typeof day.palestra === 'boolean') ? day.palestra : p.days.some(d=>d.weekday===wd);
    const gymBadge = isGym ? '<span class="gym-badge">palestra</span>' : '';
    if(day.libera){
      return `<div class="diet-day-card${wd==='Domenica'?' full-width-card':''}">
        <div class="diet-day-head"><span class="wd">${wd}</span><span class="diet-free-badge">Libero</span></div>
        <div class="diet-meal-row">${day.testo||''}</div>
      </div>`;
    }
    return `<div class="diet-day-card${wd==='Domenica'?' full-width-card':''}">
      <div class="diet-day-head"><span class="wd">${wd}${gymBadge}</span></div>
      <div class="diet-meal-row"><b>Colazione</b>${day.colazione||'-'}</div>
      <div class="diet-meal-row"><b>Pranzo</b>${day.pranzo||'-'}</div>
      <div class="diet-meal-row"><b>Spuntino</b>${day.spuntino||'-'}</div>
      <div class="diet-meal-row"><b>Cena</b>${day.cena||'-'}</div>
    </div>`;
  }).join('');
}

// ============================================================
