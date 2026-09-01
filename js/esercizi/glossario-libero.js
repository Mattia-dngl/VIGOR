// ---------- GLOSSARIO (basato sulla figura) ----------
let GL_BUILT = false;
let glZone = null;

function glBuildAll(){
  if(GL_BUILT) return;
  const donna = sonoDonna();
  const dati = donna ? GEO_DONNA : GEO;
  const introEl = document.getElementById('glossIntroText');
  if(introEl){
    introEl.textContent = donna
      ? "Tocca un muscolo sulla figura per vedere gli esercizi che lo allenano e come si eseguono. Sono gli stessi esercizi che trovi nella scheda e nell'allenamento libero."
      : "Tocca un muscolo sulla figura per vedere gli esercizi che lo allenano e come si eseguono. Il petto è diviso in tre fasce: alto, medio e basso. Sono gli stessi esercizi che trovi nella scheda e nell'allenamento libero.";
  }
  const svgF = document.getElementById('glFront'), svgB = document.getElementById('glBack');
  if(donna){
    svgF.setAttribute('viewBox', dati.viewBoxFront.join(' '));
    svgB.setAttribute('viewBox', dati.viewBoxBack.join(' '));
  } else {
    svgF.setAttribute('viewBox', '0 0 724 1448');
    svgB.setAttribute('viewBox', '724 0 724 1448');
  }
  mpBuildFigure(svgF, dati.front, dati.outlineFront);
  mpBuildFigure(svgB, dati.back,  dati.outlineBack);
  document.querySelectorAll('#view-glossario .mp-zone-g').forEach(g=>{
    g.addEventListener('click', ()=>glSelectZone(g.dataset.slug));
    g.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); glSelectZone(g.dataset.slug); } });
  });
  enableFigureZoom(svgF);
  enableFigureZoom(svgB);
  GL_BUILT = true;
}

function glRenderList(list, titolo){
  document.getElementById('glZoneTitle').textContent = titolo;
  document.getElementById('glossCount').textContent =
    list.length===0 ? "" : (list.length===1 ? "1 esercizio" : list.length+" esercizi");
  const box = document.getElementById('glossList');
  if(list.length===0){
    box.innerHTML = '<div class="empty">Nessun esercizio per questa ricerca.</div>';
    return;
  }
  box.innerHTML = list.map(ex=>`
    <div class="gloss-item">
      <div class="gloss-name">${ex.n}</div>
      <div class="gloss-desc">${ex.d}</div>
      <div class="gloss-tags">
        <span class="mp-tag">${ex.g}</span>
        ${ex.slugs.map(s=>`<span class="mp-tag zone">${ZONE_LABEL[s]||s}</span>`).join('')}
        ${(ex.tipo && ex.tipo.indexOf('tempo')===0) || ex.tempo?'<span class="mp-tag time">a tempo</span>':''}
        <a class="mp-video" href="${escapeAttr(getExerciseVideoInfo(ex.n).url)}" data-ex-name="${escapeAttr(ex.n)}">▶ Video</a>
        <button type="button" class="mp-video-gestisci" data-gestisci="${escapeAttr(ex.n)}" title="Scegli quale video usare">⋯</button>
      </div>
    </div>`).join('');
}

function glSelectZone(slug){
  glZone = slug;
  document.getElementById('glossSearch').value = "";
  document.querySelectorAll('#view-glossario .mp-zone-g').forEach(g=>{
    g.classList.toggle('active', g.dataset.slug===slug);
  });
  glRenderList(exercisesForZone(slug), ZONE_LABEL[slug]===ZONE_GROUP[slug] ? ZONE_LABEL[slug] : `${ZONE_LABEL[slug]} — ${ZONE_GROUP[slug]}`);
  if(window.innerWidth <= 700){
    const t = document.getElementById('glZoneTitle');
    if(t && t.scrollIntoView) t.scrollIntoView({ behavior:'smooth', block:'start' });
  }
}

function renderGlossario(){
  glBuildAll();
  const q = (document.getElementById('glossSearch').value||'').trim().toLowerCase();
  if(q.length>=2){
    document.querySelectorAll('#view-glossario .mp-zone-g').forEach(g=>g.classList.remove('active'));
    glZone = null;
    glRenderList(EX_LIB.filter(e=>e.n.toLowerCase().includes(q) || e.d.toLowerCase().includes(q)),
                 `Risultati per "${document.getElementById('glossSearch').value.trim()}"`);
    return;
  }
  if(glZone){ glSelectZone(glZone); return; }
  document.getElementById('glZoneTitle').textContent = "Tocca un muscolo sulla figura";
  document.getElementById('glossCount').textContent = `${EX_LIB.length} esercizi in totale`;
  document.getElementById('glossList').innerHTML =
    '<div class="empty">Scegli una zona del corpo qui sopra per vedere gli esercizi che la allenano, oppure cerca un esercizio per nome.</div>';
}

// ---------- ALLENAMENTO LIBERO (tab Registra) ----------
let FREE_DAY = { key:"LIBERO", name:"Allenamento libero", weekday:null, exercises:[] };

function rebuildFreeForm(){
  const snap = JSON.parse(JSON.stringify(currentSetInputs || {}));
  buildExerciseForm(FREE_DAY);
  // ripristina i valori gia' digitati, cosi' aggiungere un esercizio non cancella il lavoro fatto
  Object.keys(snap).forEach(name=>{
    if(!currentSetInputs[name]) return;
    snap[name].forEach((s,i)=>{
      if(!currentSetInputs[name][i]) return;
      CAMPI_SERIE.forEach(f=>{
        if(s[f]!==undefined && s[f]!==''){
          currentSetInputs[name][i][f] = s[f];
          const inp = document.querySelector(`.exercise-block input[data-ex="${CSS.escape(name)}"][data-idx="${i}"][data-field="${f}"]`);
          if(inp) inp.value = mostraValoreCampo(name, f, s[f]);
        }
      });
    });
  });
  // Lista verticale (31/08/2026): non c'è più una "posizione nel carosello"
  // da ripristinare dopo il rebuild — sono tutti visibili insieme.
}

function freeAddExercise(ex){
  if(FREE_DAY.exercises.some(e=>e.name.toLowerCase()===ex.n.toLowerCase())){
    toast("Esercizio già presente nell'allenamento."); return;
  }
  FREE_DAY.exercises.push({ name: ex.n, sets: 3, reps: "libere", muscles: ex.g ? [ex.g] : [] });
  rebuildFreeForm();
  salvaBozza();
  document.getElementById('freeEmptyHint').style.display = 'none';
  document.getElementById('exerciseFormCard').style.display = 'block';
  toast(`${ex.n} aggiunto ✓`);
}


// ---------- collegamenti mappa muscolare / glossario ----------
document.getElementById('mpClose').addEventListener('click', closeMusclePicker);
document.getElementById('mpOverlay').addEventListener('click', e=>{
  if(e.target.id==='mpOverlay') closeMusclePicker();
});
document.getElementById('mpSearch').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  if(q.length<2){
    if(mpZone) mpRenderList(exercisesForZone(mpZone), `${ZONE_LABEL[mpZone]} — ${ZONE_GROUP[mpZone]}`);
    else mpRenderList([], "Tocca un muscolo sulla figura");
    return;
  }
  document.querySelectorAll('#mpOverlay .mp-zone-g').forEach(g=>g.classList.remove('active'));
  mpZone = null;
  mpRenderList(EX_LIB.filter(x=>x.n.toLowerCase().includes(q)), `Risultati per "${e.target.value.trim()}"`);
});
document.getElementById('glossSearch').addEventListener('input', renderGlossario);
document.querySelectorAll('.gl-viewtoggle button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.gl-viewtoggle button').forEach(b=>b.classList.toggle('active', b===btn));
    const front = btn.dataset.glview==='front';
    document.getElementById('glFigFront').classList.toggle('show', front);
    document.getElementById('glFigBack').classList.toggle('show', !front);
  });
});

// su telefono si vede una figura alla volta, cosi' e' grande abbastanza per centrare le fasce
document.querySelectorAll('.mp-viewtoggle button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.mp-viewtoggle button').forEach(b=>b.classList.toggle('active', b===btn));
    const front = btn.dataset.mpview==='front';
    document.getElementById('mpFigFront').classList.toggle('show', front);
    document.getElementById('mpFigBack').classList.toggle('show', !front);
  });
});

// allenamento libero
document.getElementById('freeAddExBtn').addEventListener('click', ()=>{
  openMusclePicker("Aggiungi all'allenamento di oggi", freeAddExercise);
});
// Elenco esercizi da scegliere da un pannello con ricerca, invece di una
// tendina nativa (poco leggibile e difficile da rifinire). Usato sia
// dall'allenamento libero ("Aggiungi dall'elenco") sia dall'editor scheda
// (stesso identico modal, callback diversa a seconda di dove finisce
// l'esercizio scelto).
let listaEserciziOnPick = freeAddExercise;
function apriListaEsercizi(onPick){
  listaEserciziOnPick = onPick || freeAddExercise;
  document.getElementById('esListaCerca').value = '';
  renderListaEsercizi('');
  document.getElementById('esListaOverlay').classList.add('show');
  setTimeout(()=>document.getElementById('esListaCerca').focus(), 150);
}
function apriListaEserciziLibero(){
  apriListaEsercizi(freeAddExercise);
}
function chiudiListaEserciziLibero(){
  document.getElementById('esListaOverlay').classList.remove('show');
}
function renderListaEsercizi(filtro){
  const box = document.getElementById('esListaRisultati');
  const lp = activeProfile();
  const q = (filtro||'').trim().toLowerCase();
  const baseNames = EX_LIB.map(e=>e.n).sort((a,b)=>a.localeCompare(b,'it'));
  const personalNames = Object.keys((lp && lp.customExercises) || {}).map(toTitleCase).sort((a,b)=>a.localeCompare(b,'it'));

  const rigaCrea = `<div class="es-lista-riga es-lista-crea" data-crea="1">
      <span class="es-lista-plus">+</span><span>Crea nuovo esercizio…</span>
    </div>`;

  const filtraOrd = arr => arr.filter(n=>!q || n.toLowerCase().includes(q));
  const pers = filtraOrd(personalNames);
  const base = filtraOrd(baseNames);

  let html = !q ? rigaCrea : '';
  if(pers.length){
    html += `<div class="es-lista-gruppo">I tuoi esercizi</div>`;
    html += pers.map(n=>`<div class="es-lista-riga" data-nome="${escapeAttr(n)}">${escapeAttr(n)}</div>`).join('');
  }
  if(base.length){
    html += `<div class="es-lista-gruppo">Esercizi di base</div>`;
    html += base.map(n=>`<div class="es-lista-riga" data-nome="${escapeAttr(n)}">${escapeAttr(n)}</div>`).join('');
  }
  if(pers.length===0 && base.length===0){
    html += `<p class="hint" style="text-align:center; padding:20px 16px;">Nessun esercizio trovato.</p>`;
  }
  box.innerHTML = html;

  box.querySelectorAll('.es-lista-riga[data-nome]').forEach(riga=>{
    riga.addEventListener('click', ()=>{
      const nome = riga.dataset.nome;
      chiudiListaEserciziLibero();
      const muscoli = getExerciseMuscles(nome);
      listaEserciziOnPick({ n: nome, g: (muscoli && muscoli[0]) ? muscoli[0] : null });
    });
  });
  box.querySelectorAll('.es-lista-riga[data-crea]').forEach(riga=>{
    riga.addEventListener('click', ()=>{
      chiudiListaEserciziLibero();
      apriCreaEsercizio('', (ex)=>{ listaEserciziOnPick({ n: ex.n, g: ex.g }); });
    });
  });
}
document.getElementById('esListaCerca').addEventListener('input', e=>renderListaEsercizi(e.target.value));
document.getElementById('esListaClose').addEventListener('click', chiudiListaEserciziLibero);
document.getElementById('freeAddExManualeBtn2').addEventListener('click', apriListaEserciziLibero);
// 31/08/2026: il vecchio #freeDelExBtn globale ("Togli esercizio", legato a
// "quello che si stava guardando nel carosello") è stato tolto insieme al
// carosello — ogni riquadro esercizio ha ora il proprio tasto di rimozione,
// vedi .ex-remove-btn dentro buildExerciseForm().

// ============================================================
