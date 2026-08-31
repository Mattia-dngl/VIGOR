// ESERCIZI PERSONALIZZATI
// ============================================================
let customExSelectedMuscles = [];

function riempiTendinaTipi(){
  const sel = document.getElementById('customExTipo');
  if(!sel) return;
  sel.innerHTML = Object.entries(TIPI_MISURA).map(([k,v])=>
    `<option value="${k}">${v.nome}</option>`).join('');
}

function renderCustomExMuscleChips(){
  const wrap = document.getElementById('customExMuscles');
  wrap.innerHTML = MUSCLE_ZONES_FINE.map(m=>`<div class="muscle-chip" data-m="${m}">${etichettaZonaFine(m)}</div>`).join('');
  wrap.querySelectorAll('.muscle-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const m = chip.dataset.m;
      if(customExSelectedMuscles.includes(m)) customExSelectedMuscles = customExSelectedMuscles.filter(x=>x!==m);
      else customExSelectedMuscles.push(m);
      chip.classList.toggle('selected');
    });
  });
}

function renderCustomExList(){
  const wrap = document.getElementById('customExList');
  const lp = activeProfile();
  const canVideo = true;
  const entries = Object.entries(lp.customExercises || {});
  const opzioniTipo = (scelto)=>Object.entries(TIPI_MISURA).map(([k,v])=>
    `<option value="${k}"${k===scelto?' selected':''}>${v.nome}</option>`).join('');
  if(entries.length===0){ wrap.innerHTML = '<div class="hint">Nessun esercizio personalizzato ancora.</div>'; return; }
  // 31/08/2026: ridisegnata — era una riga presa in prestito da .exercise-edit-row
  // (pensata per i campi di un set), con link ed emoji sparsi senza gerarchia
  // ("poco curata"). Ora ogni esercizio è una scheda compatta con divisorio,
  // muscoli mostrati come chip (non testo semplice) e le due azioni allineate
  // sulla stessa riga.
  wrap.innerHTML = entries.map(([name, data])=>{
    const muscles = data.muscles || [];
    const video = data.video || '';
    const fine = eFormatoFine(muscles);
    const chips = fine
      ? muscles.map(m=>`<span class="muscle-chip mini readonly">${etichettaZonaFine(m)}</span>`).join('')
      : (muscles.length ? muscles.map(m=>`<span class="muscle-chip mini readonly">${m}</span>`).join('') : '');
    return `<div class="my-ex-item">
      <div class="my-ex-head">
        <div class="my-ex-name">${toTitleCase(name)}</div>
        <button type="button" class="remove-x" data-name="${escapeAttr(name)}" aria-label="Rimuovi ${escapeAttr(toTitleCase(name))}">×</button>
      </div>
      <div class="my-ex-muscles">${chips || '<span class="hint" style="margin:0;">Nessun muscolo indicato</span>'}</div>
      <div class="my-ex-actions">
        <button type="button" class="mio-ex-modifica-muscoli" data-name="${escapeAttr(name)}">Modifica muscoli</button>
        <select class="mio-ex-tipo my-ex-tipo-select" data-name="${escapeAttr(name)}">${opzioniTipo(tipoMisura(name))}</select>
      </div>
      <div class="muscle-chip-group mio-ex-muscoli-editor" data-name="${escapeAttr(name)}" style="display:none;"></div>
      ${video ? `<a href="${escapeAttr(video)}" data-ex-name="${escapeAttr(name)}" class="video-link">▶ Video</a>`
              : (canVideo ? `<button type="button" class="add-video-btn" data-name="${escapeAttr(name)}">+ Aggiungi link video</button>` : '')}
    </div>`;
  }).join('');
  wrap.querySelectorAll('.mio-ex-tipo').forEach(sel=>sel.addEventListener('change', ()=>{
    const lp2 = activeProfile();
    if(lp2.customExercises[sel.dataset.name]){
      lp2.customExercises[sel.dataset.name].tipo = sel.value;
      save();
      toast("Modo di registrazione aggiornato ✓");
    }
  }));
  // "Modifica muscoli": apre sotto lo stesso esercizio un selettore a zone fini
  // (come la mappa del corpo). Se l'esercizio aveva ancora i vecchi gruppi generici
  // (creato prima di questo aggiornamento), parte vuoto: la prima modifica lo
  // porta al nuovo formato.
  wrap.querySelectorAll('.mio-ex-modifica-muscoli').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const name = btn.dataset.name;
      const editor = wrap.querySelector(`.mio-ex-muscoli-editor[data-name="${CSS.escape(name)}"]`);
      if(!editor) return;
      const aperto = editor.style.display !== 'none';
      if(aperto){ editor.style.display = 'none'; return; }
      const attuali = eFormatoFine(lp.customExercises[name].muscles) ? lp.customExercises[name].muscles.slice() : [];
      editor.innerHTML = MUSCLE_ZONES_FINE.map(m=>`<div class="muscle-chip mini ${attuali.includes(m)?'selected':''}"
        data-mioexmuscle="${escapeAttr(name)}" data-m="${m}">${etichettaZonaFine(m)}</div>`).join('');
      editor.style.display = 'flex';
      editor.querySelectorAll('[data-mioexmuscle]').forEach(chip=>chip.addEventListener('click', ()=>{
        const lp2 = activeProfile();
        const ex = lp2.customExercises[name];
        if(!ex) return;
        const base = eFormatoFine(ex.muscles) ? ex.muscles : [];
        const m = chip.dataset.m;
        const nuovi = base.includes(m) ? base.filter(x=>x!==m) : base.concat([m]);
        if(nuovi.length===0){ toast("Serve almeno una zona muscolare."); return; }
        ex.muscles = nuovi;
        save();
        chip.classList.toggle('selected');
        wrap.querySelector(`.exercise-edit-row .hint`); // no-op di sicurezza, l'etichetta si aggiorna al prossimo render
        renderCustomExList();
        setTimeout(()=>{
          const riapri = wrap.querySelector(`.mio-ex-modifica-muscoli[data-name="${CSS.escape(name)}"]`);
          if(riapri) riapri.click();
        }, 0);
      }));
    });
  });
  wrap.querySelectorAll('.remove-x').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      delete activeProfile().customExercises[btn.dataset.name];
      save();
      renderCustomExList();
      toast("Esercizio personalizzato rimosso");
    });
  });
  wrap.querySelectorAll('.add-video-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const url = prompt("Incolla il link del video dimostrativo (YouTube, Vimeo, ecc.):");
      if(url && url.trim()){
        activeProfile().customExercises[btn.dataset.name].video = url.trim();
        save();
        renderCustomExList();
        toast("Video aggiunto ✓");
      }
    });
  });
}

function renderBaseExerciseList(){
  const wrap = document.getElementById('baseExList');
  const countEl = document.getElementById('baseExCount');
  const nomi = EX_LIB.map(e=>e.n.toLowerCase()).sort();
  countEl.textContent = nomi.length;

  // raggruppati per gruppo muscolare: con 165 voci una lista unica è inconsultabile
  const gruppi = {};
  nomi.forEach(n=>{
    const lib = libFind(n);
    const g = lib ? lib.g : "Altri";
    (gruppi[g] = gruppi[g] || []).push(n);
  });

  const opzioniTipo = (scelto)=>Object.entries(TIPI_MISURA).map(([k,v])=>
    `<option value="${k}"${k===scelto?' selected':''}>${v.nome}</option>`).join('');

  wrap.innerHTML = MUSCLE_GROUPS.concat(Object.keys(gruppi).filter(g=>!MUSCLE_GROUPS.includes(g)))
    .filter(g=>gruppi[g] && gruppi[g].length)
    .map(g=>`
      <details class="gruppo-ex">
        <summary>${g} <span class="conta">${gruppi[g].length}</span></summary>
        <div class="gruppo-corpo">
          ${gruppi[g].map(name=>{
            const lib = libFind(name);
            const isOverridden = !!(state.baseExerciseOverrides && state.baseExerciseOverrides[name]);
            // parto sempre dalle zone già curate in esercizi.js (fini, es. chest-medio):
            // così l'admin corregge solo le eccezioni invece di ritaggare 165 esercizi da zero
            const current = isOverridden ? zoneFiniValide(state.baseExerciseOverrides[name])
                          : ((lib && lib.slugs) ? lib.slugs.slice() : []);
            return `<div class="base-ex-row">
              <div class="base-ex-head">
                <span class="base-ex-name">${(lib||{}).n || toTitleCase(name)}</span>
                ${isOverridden ? '<span class="badge-attesa">modificato</span>' : ''}
              </div>
              <div class="base-ex-muscles">
                ${MUSCLE_ZONES_FINE.map(m=>`<span class="muscle-chip mini ${current.includes(m)?'selected':''}"
                   data-basemuscle="${escapeAttr(name)}" data-m="${m}">${etichettaZonaFine(m)}</span>`).join('')}
              </div>
              <div class="base-ex-riga2">
                <select class="base-ex-tipo" data-name="${escapeAttr(name)}">${opzioniTipo(tipoMisura(name))}</select>
                <input type="text" class="base-ex-video-input" data-name="${escapeAttr(name)}"
                       placeholder="Link video" value="${escapeAttr((state.baseExerciseVideos||{})[name]||'')}">
                <button class="save-video-btn" data-name="${escapeAttr(name)}" title="Salva">✓</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </details>`).join('');

  wrap.querySelectorAll('[data-basemuscle]').forEach(chip=>chip.addEventListener('click', ()=>{
    const name = chip.dataset.basemuscle, m = chip.dataset.m;
    if(!state.baseExerciseOverrides) state.baseExerciseOverrides = {};
    const lib = libFind(name);
    const attuali = state.baseExerciseOverrides[name]
      ? zoneFiniValide(state.baseExerciseOverrides[name])
      : ((lib && lib.slugs) ? lib.slugs.slice() : []);
    const nuovi = attuali.includes(m) ? attuali.filter(x=>x!==m) : attuali.concat([m]);
    if(nuovi.length === 0){ toast("Serve almeno una zona muscolare."); return; }
    state.baseExerciseOverrides[name] = nuovi;
    save();
    chip.classList.toggle('selected');
  }));

  wrap.querySelectorAll('.base-ex-tipo').forEach(sel=>sel.addEventListener('change', ()=>{
    if(!state.baseExerciseTipi) state.baseExerciseTipi = {};
    state.baseExerciseTipi[sel.dataset.name] = sel.value;
    save();
    toast("Modo di registrazione aggiornato ✓");
  }));

  wrap.querySelectorAll('.base-ex-video-input').forEach(inp=>{
    const salva = ()=>{
      const name = inp.dataset.name, url = inp.value.trim();
      if(url === ((state.baseExerciseVideos||{})[name] || '').trim()) return;
      if(!state.baseExerciseVideos) state.baseExerciseVideos = {};
      if(url) state.baseExerciseVideos[name] = url; else delete state.baseExerciseVideos[name];
      save();
      toast(url ? "Video salvato ✓" : "Video rimosso");
    };
    inp.addEventListener('change', salva);
    inp.addEventListener('blur', salva);
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); inp.blur(); } });
  });
  wrap.querySelectorAll('.save-video-btn').forEach(b=>b.addEventListener('click', ()=>{
    const inp = wrap.querySelector(`.base-ex-video-input[data-name="${CSS.escape(b.dataset.name)}"]`);
    if(inp) inp.blur();
  }));
}

// ============================================================
