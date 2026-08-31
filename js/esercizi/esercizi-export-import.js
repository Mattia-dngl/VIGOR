// EXPORT / IMPORT LINK VIDEO ESERCIZI DI BASE (solo owner) — Excel
// ============================================================
document.getElementById('exportExVideosBtn').addEventListener('click', ()=>{
  const lp = loggedInProfile();
  if(!lp){ return; }
  try{
    const senzaExcel = (typeof XLSX === 'undefined');
    const names = EX_LIB.map(e=>e.n.toLowerCase()).sort();
    const rows = [["Esercizio","Gruppo","Link video"]];
    names.forEach(n=>{
      const lib = libFind(n);
      rows.push([ lib ? lib.n : toTitleCase(n), lib ? lib.g : "", state.baseExerciseVideos[n] || "" ]);
    });
    const oggi = new Date().toISOString().slice(0,10);

    if(senzaExcel){
      // niente libreria (di solito perché sei offline): scrivo un CSV, che l'app sa rileggere
      const csv = rows.map(r => r.map(v => {
        const s = (v==null? '' : String(v));
        return /[;"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
      }).join(';')).join('\n');
      const blob = new Blob(["\uFEFF" + csv], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `link-video-esercizi-${oggi}.csv`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
      toast("Esportato in CSV ✓ (si riapre con Excel)");
      return;
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:42},{wch:17},{wch:62}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Video");
    XLSX.writeFile(wb, `link-video-esercizi-${oggi}.xlsx`);
    toast("Esportato ✓");
  }catch(err){
    console.error(err);
    toast("Errore durante l'esportazione: " + err.message);
  }
});

document.getElementById('importExVideosBtn').addEventListener('click', ()=>{
  const lp = loggedInProfile();
  if(!lp){ return; }
  document.getElementById('importExVideosInput').click();
});

// Legge un CSV senza librerie esterne: cosi' l'importazione funziona anche offline,
// mentre il formato .xlsx richiede la libreria caricata da internet.
// Gestisce virgolette, virgole dentro i campi e separatore virgola o punto e virgola
// (Excel italiano salva con il punto e virgola).
function parseCsv(testo){
  const t = testo.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const primaRiga = t.slice(0, t.indexOf('\n') === -1 ? t.length : t.indexOf('\n'));
  const sep = (primaRiga.split(';').length > primaRiga.split(',').length) ? ';' : ',';
  const righe = [];
  let campo = '', riga = [], dentroVirgolette = false;
  for(let i=0; i<t.length; i++){
    const ch = t[i];
    if(dentroVirgolette){
      if(ch === '"'){
        if(t[i+1] === '"'){ campo += '"'; i++; }
        else dentroVirgolette = false;
      } else campo += ch;
    } else if(ch === '"'){ dentroVirgolette = true; }
    else if(ch === sep){ riga.push(campo); campo = ''; }
    else if(ch === '\n'){ riga.push(campo); righe.push(riga); riga = []; campo = ''; }
    else campo += ch;
  }
  if(campo.length || riga.length){ riga.push(campo); righe.push(riga); }
  return righe.filter(r => r.some(x => (x||'').trim() !== ''));
}

document.getElementById('importExVideosInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const statusEl = document.getElementById('importExVideosStatus');
  const isCsv = /\.csv$/i.test(file.name);
  const reader = new FileReader();
  reader.onload = async (ev)=>{
    try{
      let rows;
      if(isCsv){
        rows = parseCsv(ev.target.result);
      } else {
        rows = await leggiXlsx(ev.target.result);
      }

      // mappa nome-lowercase -> chiave esatta del database esercizi, per abbinare anche se il nome nel file
      // ha maiuscole/minuscole diverse (es. "Panca Piana" nel file vs "panca piana" nel database)
      const nameToKey = {};
      Object.keys(EXERCISE_MUSCLE_MAP).forEach(k=>{ nameToKey[k.toLowerCase()] = k; });
      EX_LIB.forEach(e=>{ const k=e.n.toLowerCase(); if(!nameToKey[k]) nameToKey[k]=k; });

      const esito = importaRigheVideo(rows);
      let updated = esito.aggiornati, removed = esito.rimossi, unmatched = esito.scartate;
      save();
      renderBaseExerciseList();
      if(typeof renderGlossario==='function' && GL_BUILT) renderGlossario();

      let msg = `Importati ${updated} link video su ${EX_LIB.length} esercizi`;
      if(removed>0) msg += `, ${removed} rimossi (cella vuota)`;
      if(unmatched.length>0) msg += `. ${unmatched.length} riga/e non riconosciuta/e: ${unmatched.slice(0,3).join(', ')}${unmatched.length>3?'…':''}`;
      statusEl.textContent = msg;
      toast("Import completato ✓");
    }catch(err){
      statusEl.textContent = "Non sono riuscito a leggere il file (" + (err.message||'errore') + "). "
        + "Controlla che sia il foglio \"Video\" del file fornito, oppure salvalo come CSV e riprova.";
      console.error(err);
    }
    e.target.value = "";
  };
  if(isCsv) reader.readAsText(file, 'utf-8');
  else reader.readAsArrayBuffer(file);
});

document.getElementById('addCustomExBtn').addEventListener('click', ()=>{
  const nameInput = document.getElementById('customExName');
  const name = nameInput.value.trim();
  if(!name){ toast("Scrivi il nome dell'esercizio."); return; }
  if(customExSelectedMuscles.length===0){ toast("Seleziona almeno un gruppo muscolare."); return; }
  const lp = loggedInProfile();
  if(!lp.customExercises) lp.customExercises = {};
  const videoInput = document.getElementById('customExVideo');
  const video = (isManager(lp) && videoInput.value.trim()) ? videoInput.value.trim() : '';
  lp.customExercises[name.toLowerCase()] = {
    muscles: [...customExSelectedMuscles], video,
    tipo: document.getElementById('customExTipo').value || 'peso'
  };
  save();
  nameInput.value = "";
  if(videoInput) videoInput.value = "";
  customExSelectedMuscles = [];
  renderCustomExMuscleChips();
  renderCustomExList();
  toast(`"${name}" aggiunto ai tuoi esercizi ✓`);
});


// ============================================================
