// ---------- schermate ----------
function mostraCloudGate(quale){
  document.documentElement.classList.remove('avvio');
  document.body.classList.remove('app-pronta');
  document.getElementById('lockScreen').style.display = 'none';
  document.getElementById('profileGate').style.display = 'none';
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('accountPanel').style.display = 'none';
  const g = document.getElementById('cloudGate');
  g.style.display = 'flex';
  document.getElementById('cloudAccedi').style.display     = quale === 'accedi'      ? 'block':'none';
  document.getElementById('cloudRegistra').style.display   = quale === 'registra'    ? 'block':'none';
  // Registrazione in due passi (01/09/2026): ogni volta che si apre "Registrati"
  // si riparte sempre dal passo 1 (email), mai a metà di un tentativo precedente.
  if(quale === 'registra' && typeof resetRegistrazioneStep1 === 'function') resetRegistrazioneStep1();
  document.getElementById('cloudAttesa').style.display     = quale === 'attesa'      ? 'block':'none';
  document.getElementById('cloudCaricamento').style.display= quale === 'caricamento' ? 'block':'none';
  document.getElementById('cloudRecovery').style.display   = quale === 'recovery'    ? 'block':'none';
  if(quale !== 'accedi') document.getElementById('confermaEmailBanner').style.display = 'none';
}
function nascondiCloudGate(){ document.getElementById('cloudGate').style.display = 'none'; }

// ---------- Home: la schermata con cui entri, da qui vai verso le varie parti ----------
let _impostazioniProvenienza = 'home';   // dove torna "Chiudi" in Impostazioni: 'home' o 'app'

// quanti allenamenti previsti dalla scheda sono già stati fatti questa settimana
function obiettivoSettimanale(prof, programma){
  if(!programma || !programma.days || programma.days.length===0) return {fatti:0, totali:0};
  const oggi = new Date();
  const lunedi = new Date(oggi);
  lunedi.setDate(oggi.getDate() - ((oggi.getDay()+6)%7));
  let fatti = 0, totali = 0;
  for(let i=0;i<7;i++){
    const d = new Date(lunedi); d.setDate(lunedi.getDate()+i);
    const wd = WEEKDAYS[d.getDay()];
    const scheduled = programma.days.find(dy=>dy.weekday===wd);
    if(!scheduled) continue;
    totali++;
    const iso = isoDaData(d);
    const log = (prof.logs||[]).find(l=>l.date===iso && l.programId===programma.id && l.status!=='saltato');
    if(log) fatti++;
  }
  return {fatti, totali};
}
// settimane consecutive (compresa quella in corso) in cui hai fatto tutti gli allenamenti previsti
function streakSettimane(prof, programma){
  if(!programma || !programma.days || programma.days.length===0) return 0;
  let streak = 0;
  const oggi = new Date();
  for(let w=0; w<52; w++){
    const lunedi = new Date(oggi);
    lunedi.setDate(oggi.getDate() - ((oggi.getDay()+6)%7) - w*7);
    let tutteFatte = true, cePrevista = false;
    for(let i=0;i<7;i++){
      const d = new Date(lunedi); d.setDate(lunedi.getDate()+i);
      if(w===0 && d>oggi) continue;   // i giorni futuri di questa settimana non contano ancora
      const wd = WEEKDAYS[d.getDay()];
      const scheduled = programma.days.find(dy=>dy.weekday===wd);
      if(!scheduled) continue;
      cePrevista = true;
      const iso = isoDaData(d);
      const log = (prof.logs||[]).find(l=>l.date===iso && l.programId===programma.id && l.status!=='saltato');
      if(!log){ tutteFatte = false; break; }
    }
    if(!cePrevista) break;
    if(tutteFatte) streak++; else break;
  }
  return streak;
}

// ============================================================
// OBIETTIVI (Home): costanza mensile (automatica) + peso e record su un
// esercizio (impostati dalla persona). Nessun dato duplicato: peso e record
// si leggono sempre da measurements/logs, qui si salva solo il traguardo.
// ============================================================
// come obiettivoSettimanale, ma su tutto il mese solare in corso
function obiettivoMensile(prof, programma){
  if(!programma || !programma.days || programma.days.length===0) return {fatti:0, totali:0};
  const oggi = new Date();
  const giorniNelMese = new Date(oggi.getFullYear(), oggi.getMonth()+1, 0).getDate();
  let fatti = 0, totali = 0;
  for(let g=1; g<=giorniNelMese; g++){
    const d = new Date(oggi.getFullYear(), oggi.getMonth(), g);
    const wd = WEEKDAYS[d.getDay()];
    const scheduled = programma.days.find(dy=>dy.weekday===wd);
    if(!scheduled) continue;
    totali++;
    const iso = isoDaData(d);
    const log = (prof.logs||[]).find(l=>l.date===iso && l.programId===programma.id && l.status!=='saltato');
    if(log) fatti++;
  }
  return {fatti, totali};
}

// percentuale/avanzamento dell'obiettivo di peso impostato (prof.obiettivoPeso):
// funziona sia per dimagrire sia per aumentare peso, il verso lo decide il
// rapporto fra partenza e target, non un valore fisso "in giù"
function progressoObiettivoPeso(prof){
  const ob = prof.obiettivoPeso;
  if(!ob) return null;
  const ultimo = ultimoPesoRegistrato(prof);
  const attuale = ultimo ? ultimo.weight : ob.partenza;
  const range = ob.target - ob.partenza;
  const percento = range !== 0
    ? Math.max(0, Math.min(100, Math.round((attuale - ob.partenza) / range * 100)))
    : (attuale === ob.target ? 100 : 0);
  const raggiunto = range > 0 ? attuale >= ob.target : attuale <= ob.target;
  const oggi = new Date(); oggi.setHours(0,0,0,0);
  const scadenza = new Date(ob.scadenza + 'T00:00:00');
  const giorniRimasti = Math.round((scadenza - oggi) / 86400000);
  return { attuale, target: ob.target, partenza: ob.partenza, percento, raggiunto,
    giorniRimasti, scaduto: giorniRimasti < 0 && !raggiunto };
}

// percentuale/avanzamento dell'obiettivo su un esercizio (prof.obiettivoRecord),
// riusa recordPersonale così il numero è sempre lo stesso mostrato in Storico
function progressoObiettivoRecord(prof){
  const ob = prof.obiettivoRecord;
  if(!ob) return null;
  const timeBased = isTimeBasedExercise(ob.esercizio);
  const record = recordPersonale(prof, ob.esercizio);
  const attuale = record ? record.valore : 0;
  const percento = ob.target > 0 ? Math.max(0, Math.min(100, Math.round(attuale/ob.target*100))) : 0;
  return { esercizio: ob.esercizio, attuale, target: ob.target, percento, timeBased, raggiunto: attuale >= ob.target };
}

// aggiorna la card "I tuoi obiettivi" in Home: costanza mensile sempre visibile,
// peso e record solo se impostati (altrimenti resta solo l'accordion per crearli)
function renderObiettivi(prof, programma){
  const {fatti, totali} = obiettivoMensile(prof, programma);
  document.getElementById('homeObMeseSub').textContent = totali>0 ? `${fatti} / ${totali} allenamenti` : 'Nessuna scheda attiva';
  document.getElementById('homeObMeseFill').style.width = totali>0 ? `${Math.min(100, Math.round(fatti/totali*100))}%` : '0%';

  const rigaPeso = document.getElementById('homeObPesoRiga');
  const ob = prof.obiettivoPeso;
  if(ob){
    const p = progressoObiettivoPeso(prof);
    rigaPeso.style.display = 'flex';
    document.getElementById('homeObPesoFill').style.width = `${p.percento}%`;
    let sub = `${p.attuale != null ? p.attuale : '—'} → ${p.target} kg`;
    if(p.raggiunto) sub += ' · raggiunto! 🎉';
    else if(p.scaduto) sub += ' · scadenza superata';
    else sub += ` · ${p.giorniRimasti} giorni rimasti`;
    document.getElementById('homeObPesoSub').textContent = sub;
    document.getElementById('homeObPesoSummary').textContent = 'Modifica obiettivo di peso';
    document.getElementById('obPesoTarget').value = ob.target;
    document.getElementById('obPesoScadenza').value = ob.scadenza;
    document.getElementById('obPesoRimuoviBtn').style.display = 'inline-block';
  } else {
    rigaPeso.style.display = 'none';
    document.getElementById('homeObPesoSummary').textContent = '+ Imposta un obiettivo di peso';
    document.getElementById('obPesoTarget').value = '';
    document.getElementById('obPesoScadenza').value = '';
    document.getElementById('obPesoRimuoviBtn').style.display = 'none';
  }

  const rigaRecord = document.getElementById('homeObRecordRiga');
  const selEsercizi = document.getElementById('obRecordEsercizio');
  const nomiEsercizi = [...new Set((prof.logs||[]).flatMap(l=>(l.exercises||[]).map(e=>e.name)))].sort();
  selEsercizi.innerHTML = nomiEsercizi.length
    ? nomiEsercizi.map(n=>`<option value="${n}">${n}</option>`).join('')
    : '<option value="">Registra prima un allenamento</option>';
  const obr = prof.obiettivoRecord;
  if(obr){
    const r = progressoObiettivoRecord(prof);
    rigaRecord.style.display = 'flex';
    document.getElementById('homeObRecordNome').textContent = obr.esercizio;
    document.getElementById('homeObRecordFill').style.width = `${r.percento}%`;
    const unita = r.timeBased ? ' sec' : ' kg';
    let sub = `${r.attuale}${unita} → ${r.target}${unita}`;
    if(r.raggiunto) sub += ' · raggiunto! 🎉';
    document.getElementById('homeObRecordSub').textContent = sub;
    document.getElementById('homeObRecordSummary').textContent = 'Modifica obiettivo esercizio';
    if(nomiEsercizi.includes(obr.esercizio)) selEsercizi.value = obr.esercizio;
    document.getElementById('obRecordTarget').value = obr.target;
    document.getElementById('obRecordRimuoviBtn').style.display = 'inline-block';
  } else {
    rigaRecord.style.display = 'none';
    document.getElementById('homeObRecordSummary').textContent = '+ Imposta un obiettivo su un esercizio';
    document.getElementById('obRecordTarget').value = '';
    document.getElementById('obRecordRimuoviBtn').style.display = 'none';
  }
}

document.getElementById('obPesoSalvaBtn').addEventListener('click', ()=>{
  const prof = activeProfile();
  const target = parseFloat(document.getElementById('obPesoTarget').value);
  const scadenza = document.getElementById('obPesoScadenza').value;
  if(!target || target<=0){ toast("Inserisci un peso obiettivo valido."); return; }
  if(!scadenza){ toast("Inserisci una data di scadenza."); return; }
  // la partenza si fissa una sola volta, al primo salvataggio dell'obiettivo
  // (o quando lo si reimposta dopo averlo rimosso): serve a calcolare quanta
  // strada è stata fatta, non solo quanta ne manca
  const ultimo = ultimoPesoRegistrato(prof);
  const partenza = (prof.obiettivoPeso && prof.obiettivoPeso.partenza != null)
    ? prof.obiettivoPeso.partenza : (ultimo ? ultimo.weight : target);
  prof.obiettivoPeso = { target, scadenza, partenza };
  save();
  document.getElementById('homeObPesoForm').open = false;
  renderObiettivi(prof, activeProgram());
  toast("Obiettivo salvato ✓");
});
document.getElementById('obPesoRimuoviBtn').addEventListener('click', ()=>{
  const prof = activeProfile();
  prof.obiettivoPeso = null;
  save();
  document.getElementById('homeObPesoForm').open = false;
  renderObiettivi(prof, activeProgram());
});

document.getElementById('obRecordSalvaBtn').addEventListener('click', ()=>{
  const prof = activeProfile();
  const esercizio = document.getElementById('obRecordEsercizio').value;
  const target = parseFloat(document.getElementById('obRecordTarget').value);
  if(!esercizio){ toast("Registra almeno un allenamento con questo esercizio prima."); return; }
  if(!target || target<=0){ toast("Inserisci un obiettivo valido."); return; }
  prof.obiettivoRecord = { esercizio, target };
  save();
  document.getElementById('homeObRecordForm').open = false;
  renderObiettivi(prof, activeProgram());
  toast("Obiettivo salvato ✓");
});
document.getElementById('obRecordRimuoviBtn').addEventListener('click', ()=>{
  const prof = activeProfile();
  prof.obiettivoRecord = null;
  save();
  document.getElementById('homeObRecordForm').open = false;
  renderObiettivi(prof, activeProgram());
});

// zone anatomiche coinvolte da un esercizio: prima gli esercizi personali (le zone scelte
// in fase di creazione), poi la libreria di base (EX_LIB[].slugs). Serve per la heatmap
// muscolare della home: è volutamente diversa da getExerciseMuscles(), che invece torna
// il gruppo generico (es. "Petto") usato per il grafico volume — qui servono gli slug fini
// (chest-alto, quadriceps...) per colorare la figura corpo.js/corpo-donna.js.
function slugsEsercizio(nome){
  const n = (nome||'').trim().toLowerCase();
  if(!n) return [];
  const lp = activeProfile();
  // esercizio personale: uso le zone fini se già in quel formato; se è un esercizio
  // vecchio (salvato prima di questo aggiornamento, gruppi generici tipo "Petto") non
  // posso risalire alla zona precisa, quindi lo lascio fuori dalla mappa finché non
  // viene ri-taggato dalle Impostazioni (ora modificabile)
  if(lp && lp.customExercises && lp.customExercises[n] && lp.customExercises[n].muscles){
    return zoneFiniValide(lp.customExercises[n].muscles);
  }
  // un admin può aver corretto le zone di un esercizio di base dalle Impostazioni
  if(state.baseExerciseOverrides && state.baseExerciseOverrides[n]){
    const fini = zoneFiniValide(state.baseExerciseOverrides[n]);
    if(fini.length) return fini;
  }
  const info = (typeof libFind==='function') ? libFind(n) : null;
  return (info && info.slugs) ? info.slugs : [];
}

// quante volte ogni zona è stata allenata questa settimana (lunedì-oggi), contando
// una volta per ogni esercizio registrato che coinvolge quella zona. Stessa settimana
// (lunedì-domenica) usata da obiettivoSettimanale/streakSettimane, per coerenza.
function heatmapSettimana(prof){
  const conteggio = {};
  if(!prof || !prof.logs) return conteggio;
  const oggi = new Date();
  const lunedi = new Date(oggi);
  lunedi.setDate(oggi.getDate() - ((oggi.getDay()+6)%7));
  lunedi.setHours(0,0,0,0);
  prof.logs.forEach(log=>{
    if(log.status !== 'registrato') return;
    const d = new Date(log.date+'T00:00:00');
    if(d < lunedi || d > oggi) return;
    (log.exercises||[]).forEach(ex=>{
      slugsEsercizio(ex.name).forEach(slug=>{ conteggio[slug] = (conteggio[slug]||0) + 1; });
    });
  });
  return conteggio;
}

async function aggiornaCampanellaHome(){
  const dot = document.getElementById('homeBellDot');
  if(!dot) return;
  try{
    // il pallino compare se c'è qualcosa da guardare: richieste PT in sospeso
    // (per chi è PT), account da approvare (per l'amministratore), messaggi
    // non ancora letti, o modifiche a scheda/dieta non ancora viste
    const richiestePT = (typeof _rapporti !== 'undefined' && sonoPT())
      ? _rapporti.filter(r => r.pt_id === (utenteOnline||{}).id && r.stato === 'in_attesa').length : 0;
    const approvazioni = (sonoAmministratore() && window._profiliAdmin)
      ? window._profiliAdmin.filter(x=>!x.approvato).length : 0;
    let nonLetti = 0;
    const idRapporti = idRapportiRilevanti();
    if(sb && utenteOnline && idRapporti.length>0){
      const { count } = await sb.from('messaggi').select('id', {count:'exact', head:true})
        .in('rapporto_id', idRapporti).eq('letto', false).neq('mittente_id', utenteOnline.id);
      nonLetti = count || 0;
    }
    let modifichePendenti = 0;
    const mioAttivo = (typeof mioRapportoAttivo === 'function') ? mioRapportoAttivo() : null;
    if(mioAttivo){
      const lp = loggedInProfile();
      if(lp){
        if(lp.schedaModificataDa==='pt' && (!lp.schedaVistaClienteIl || lp.schedaModificataIl > lp.schedaVistaClienteIl)) modifichePendenti++;
        if(lp.dietaModificataDa==='pt' && (!lp.dietaVistaClienteIl || lp.dietaModificataIl > lp.dietaVistaClienteIl)) modifichePendenti++;
      }
    }
    if(sonoPT()){
      const miClienti = _rapporti.filter(r=>r.pt_id===utenteOnline.id && r.stato==='attivo');
      for(const r of miClienti){
        const p = await leggiProfilo(r.cliente_id);
        const d = (p && p.dati) || {};
        if(d.schedaModificataDa==='cliente' && (!d.schedaVistaPtIl || d.schedaModificataIl > d.schedaVistaPtIl)) modifichePendenti++;
        if(d.dietaModificataDa==='cliente' && (!d.dietaVistaPtIl || d.dietaModificataIl > d.dietaVistaPtIl)) modifichePendenti++;
        const ultimoCheckin = checkinPiuRecente(d.checkins);
        if(ultimoCheckin && (!d.checkinVistaPtIl || checkinCreatoIl(ultimoCheckin) > d.checkinVistaPtIl)) modifichePendenti++;
      }
    }
    dot.style.display = (richiestePT + approvazioni + nonLetti + modifichePendenti) > 0 ? 'block' : 'none';
  }catch(e){ console.error(e); }
}
// gli id dei rapporti PT-cliente che mi riguardano attivamente: per chi è PT,
// tutti i clienti attivi; per chi è cliente, il proprio (se ce l'ha)
function idRapportiRilevanti(){
  if(typeof _rapporti === 'undefined') return [];
  const mieiComePT = _rapporti.filter(r=>r.pt_id===(utenteOnline||{}).id && r.stato==='attivo').map(r=>r.id);
  const mioComeCliente = mioRapportoAttivo();
  return mioComeCliente ? [...mieiComePT, mioComeCliente.id] : mieiComePT;
}

async function apriNotifiche(){
  document.getElementById('notificheOverlay').classList.add('show');
  document.getElementById('notifCorpo').innerHTML = '<p class="hint" style="text-align:center; margin-top:20px;">Carico…</p>';
  await renderNotifiche();
}
function chiudiNotifiche(){
  document.getElementById('notificheOverlay').classList.remove('show');
}
async function renderNotifiche(){
  const box = document.getElementById('notifCorpo');
  const voci = [];

  // richieste PT in sospeso (lato PT)
  if(sonoPT()){
    const richieste = _rapporti.filter(r=>r.pt_id===utenteOnline.id && r.stato==='in_attesa');
    for(const r of richieste){
      const p = await leggiProfilo(r.cliente_id);
      voci.push({ icona:'🤝', titolo:`${nomeDi(p)} vuole essere seguito da te`, sotto:'Richiesta Personal Trainer',
        onTap: ()=>{ chiudiNotifiche(); apriAreaPT(); } });
    }
  }
  // account da approvare (lato amministratore)
  if(sonoAmministratore() && window._profiliAdmin){
    window._profiliAdmin.filter(x=>!x.approvato).forEach(p=>{
      voci.push({ icona:'✓', titolo:`${nomeDi(p)} in attesa di approvazione`, sotto:'Nuovo account',
        onTap: ()=>{ chiudiNotifiche(); apriImpostazioni('home'); document.getElementById('cardAmministrazione')?.scrollIntoView({behavior:'smooth'}); } });
    });
  }
  // messaggi non letti, uno per conversazione (il più recente)
  const idRapporti = idRapportiRilevanti();
  if(sb && utenteOnline && idRapporti.length>0){
    const { data } = await sb.from('messaggi').select('*').in('rapporto_id', idRapporti)
      .eq('letto', false).neq('mittente_id', utenteOnline.id).order('creato_il', {ascending:false});
    const perRapporto = {};
    (data||[]).forEach(m=>{ if(!perRapporto[m.rapporto_id]) perRapporto[m.rapporto_id] = m; });
    for(const rapportoId of Object.keys(perRapporto)){
      const m = perRapporto[rapportoId];
      const r = _rapporti.find(x=>x.id===rapportoId);
      if(!r) continue;
      const altroId = r.pt_id===utenteOnline.id ? r.cliente_id : r.pt_id;
      const p = await leggiProfilo(altroId);
      voci.push({ icona:'💬', titolo:`${nomeDi(p)}`, sotto: m.tipo==='testo' ? m.testo : m.testo,
        onTap: ()=>{ chiudiNotifiche(); apriMessaggi(rapportoId, altroId, nomeDi(p)); } });
    }
  }

  // il mio PT ha aggiornato la mia scheda o la mia dieta (lato cliente)
  const mioAttivo = (typeof mioRapportoAttivo === 'function') ? mioRapportoAttivo() : null;
  if(mioAttivo){
    const lp = loggedInProfile();
    if(lp){
      const pt = await leggiProfilo(mioAttivo.pt_id);
      if(lp.schedaModificataDa === 'pt' && (!lp.schedaVistaClienteIl || lp.schedaModificataIl > lp.schedaVistaClienteIl)){
        voci.push({ icona:'📋', titolo:`${nomeDi(pt)} ha aggiornato la tua scheda`, sotto:'Tocca per vederla',
          onTap: ()=>{ chiudiNotifiche(); vaiA('program'); } });
      }
      if(lp.dietaModificataDa === 'pt' && (!lp.dietaVistaClienteIl || lp.dietaModificataIl > lp.dietaVistaClienteIl)){
        voci.push({ icona:'🥗', titolo:`${nomeDi(pt)} ha aggiornato la tua dieta`, sotto:'Tocca per vederla',
          onTap: ()=>{ chiudiNotifiche(); vaiA('diet'); } });
      }
    }
  }
  // un cliente che seguo ha modificato da sé la sua scheda o la sua dieta (lato PT)
  if(sonoPT()){
    const miClienti = _rapporti.filter(r=>r.pt_id===utenteOnline.id && r.stato==='attivo');
    for(const r of miClienti){
      const p = await leggiProfilo(r.cliente_id);
      const d = (p && p.dati) || {};
      if(d.schedaModificataDa === 'cliente' && (!d.schedaVistaPtIl || d.schedaModificataIl > d.schedaVistaPtIl)){
        voci.push({ icona:'📋', titolo:`${nomeDi(p)} ha modificato la sua scheda`, sotto:'Tocca per vederla',
          onTap: async ()=>{ chiudiNotifiche(); await apriCliente(r.cliente_id); document.querySelector('.pt-tab[data-pttab="scheda"]')?.click(); } });
      }
      if(d.dietaModificataDa === 'cliente' && (!d.dietaVistaPtIl || d.dietaModificataIl > d.dietaVistaPtIl)){
        voci.push({ icona:'🥗', titolo:`${nomeDi(p)} ha modificato la sua dieta`, sotto:'Tocca per vederla',
          onTap: async ()=>{ chiudiNotifiche(); await apriCliente(r.cliente_id); document.querySelector('.pt-tab[data-pttab="dieta"]')?.click(); } });
      }
      const ultimoCheckin = checkinPiuRecente(d.checkins);
      if(ultimoCheckin && (!d.checkinVistaPtIl || checkinCreatoIl(ultimoCheckin) > d.checkinVistaPtIl)){
        voci.push({ icona:'📷', titolo:`${nomeDi(p)} ha inviato un check-in`, sotto: formatDate(ultimoCheckin.data),
          onTap: async ()=>{ chiudiNotifiche(); await apriCliente(r.cliente_id); document.querySelector('.pt-tab[data-pttab="checkin"]')?.click(); } });
      }
    }
  }

  if(voci.length===0){
    box.innerHTML = `<p class="hint" style="text-align:center; margin-top:20px;">Nessuna notifica al momento.</p>`;
    return;
  }
  box.innerHTML = voci.map((v,i)=>`
    <div class="notif-riga" data-i="${i}">
      <div class="notif-icona">${v.icona}</div>
      <div class="notif-corpo"><div class="notif-titolo">${escapeAttr(v.titolo)}</div><div class="notif-sotto">${escapeAttr(v.sotto)}</div></div>
    </div>`).join('');
  box.querySelectorAll('.notif-riga').forEach(el=>{
    el.addEventListener('click', ()=>voci[parseInt(el.dataset.i)].onTap());
  });
}
document.getElementById('homeBellBtn').addEventListener('click', apriNotifiche);
document.getElementById('notifChiudiBtn').addEventListener('click', chiudiNotifiche);

function mostraHome(){
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('accountPanel').style.display = 'none';
  document.getElementById('areaPT').style.display = 'none';
  document.body.classList.remove('area-pt', 'account-aperto');
  document.body.classList.add('app-pronta');
  const p = (typeof activeProfile === 'function') ? activeProfile() : null;
  document.getElementById('homeSaluto').textContent = p && p.name ? `Bentornato, ${p.name}!` : 'Bentornato!';
  try{
    const oggiTxt = new Date().toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long'});
    document.getElementById('homeDataOggi').textContent = oggiTxt.charAt(0).toUpperCase() + oggiTxt.slice(1);
  }catch(e){ console.error(e); }
  try{
    document.getElementById('homeAvatarInitials').textContent = inizialiNome(p && p.name);
    const btn = document.getElementById('homeAvatarBtn');
    const initialsEl = document.getElementById('homeAvatarInitials');
    let img = btn.querySelector('img');
    if(p && p.avatarUrl){
      if(!img){ img = document.createElement('img'); img.alt = ''; btn.insertBefore(img, initialsEl); }
      img.src = p.avatarUrl; img.style.display = 'block'; initialsEl.style.display = 'none';
    } else {
      if(img) img.style.display = 'none';
      initialsEl.style.display = '';
    }
  }catch(e){ console.error(e); }
  try{
    const programma = p && p.programs ? p.programs.find(x=>x.id===p.activeProgramId) : null;
    const {fatti, totali} = obiettivoSettimanale(p||{}, programma);
    document.getElementById('homeGoalFatti').textContent = fatti;
    document.getElementById('homeGoalTotali').textContent = totali;
    document.getElementById('homeGoalFill').style.width = totali>0 ? `${Math.min(100, Math.round(fatti/totali*100))}%` : '0%';
    const streak = streakSettimane(p||{}, programma);
    document.getElementById('homeStreakNum').textContent = streak;
    // l'anello non ha un massimo "vero": lo riempio progressivamente fino a 8
    // settimane di fila, poi resta pieno — serve solo a dare un colpo d'occhio
    const CIRC = 2 * Math.PI * 34;
    const quota = Math.max(0, Math.min(1, streak / 8));
    const ring = document.getElementById('homeStreakRing');
    ring.style.strokeDasharray = `${CIRC}`;
    ring.style.strokeDashoffset = `${CIRC * (1 - quota)}`;
    renderObiettivi(p||{}, programma);
    aggiornaHomeCta(p, programma);
    renderHomeDayStrip(p, programma);
    renderHomeSchedaAttiva(programma);
    renderHomeDietaOggi(p);
  }catch(e){ console.error(e); }
  hmRefresh();
  aggiornaCampanellaHome();
  document.getElementById('homeScreen').style.display = 'block';
  aggiornaNavGlobale('home');
}

// Striscia Lun-Dom della settimana in corso, oggi in evidenza.
function renderHomeDayStrip(prof, programma){
  const box = document.getElementById('homeDayStrip');
  if(!box) return;
  const oggi = new Date();
  const lunedi = new Date(oggi);
  lunedi.setDate(oggi.getDate() - ((oggi.getDay()+6)%7));
  const oggiKey = oggi.toISOString().slice(0,10);
  let html = '';
  for(let i=0;i<7;i++){
    const d = new Date(lunedi); d.setDate(lunedi.getDate()+i);
    const key = d.toISOString().slice(0,10);
    const isOggi = key === oggiKey;
    const wd = WEEKDAYS[d.getDay()];
    html += `<div class="home-day-cell${isOggi?' oggi':''}">
      <div class="dow">${wd.slice(0,3).toUpperCase()}</div>
      <div class="num">${d.getDate()}</div>
    </div>`;
  }
  box.innerHTML = html;
}

// Card "Scheda attiva": nome del programma in corso.
function renderHomeSchedaAttiva(programma){
  const card = document.getElementById('homeSchedaAttivaCard');
  const nomeEl = document.getElementById('homeSchedaAttivaNome');
  if(!card || !nomeEl) return;
  if(!programma){
    card.style.display = 'none';
    return;
  }
  card.style.display = 'flex';
  nomeEl.textContent = programma.name || 'La mia scheda';
}

// Card "Dieta di oggi": macro consumati oggi (dal diario alimentare) + kcal
// rispetto al fabbisogno calcolato in Account, quando è calcolabile.
function renderHomeDietaOggi(prof){
  const kcalEl = document.getElementById('homeDietaOggiKcal');
  const body = document.getElementById('homeDietaOggiBody');
  if(!body || !prof) return;
  const oggi = new Date().toISOString().slice(0,10);
  const giorno = (prof.mealLogs||[]).find(m=>m.date===oggi);
  const items = giorno ? giorno.items : [];
  const totals = items.reduce((acc,it)=>{
    const f = (typeof datiAlimento === 'function') ? datiAlimento(it.food) : null;
    if(!f) return acc;
    const factor = it.grams/100;
    acc.kcal += f.kcal*factor; acc.p += f.p*factor; acc.c += f.c*factor; acc.f += f.f*factor;
    return acc;
  }, {kcal:0,p:0,c:0,f:0});

  const fabbisogno = (typeof calcolaFabbisogno === 'function') ? calcolaFabbisogno(prof) : null;
  let barraHtml = '';
  if(fabbisogno && !fabbisogno.mancanti.length){
    const pct = Math.min(100, Math.round(totals.kcal / fabbisogno.risultato * 100));
    kcalEl.textContent = `${Math.round(totals.kcal)} / ${fabbisogno.risultato} kcal`;
    barraHtml = `<div class="home-dieta-kcal-row">
      <div class="home-dieta-kcal-bar"><div class="home-dieta-kcal-fill" style="width:${pct}%"></div></div>
    </div>`;
  } else {
    kcalEl.textContent = `${Math.round(totals.kcal)} kcal`;
  }

  body.innerHTML = barraHtml + `
    <div class="macro-row"><span class="macro-dot" style="background:var(--diet);"></span><span class="macro-row-label">Proteine</span><span class="macro-row-val">${Math.round(totals.p)} g</span></div>
    <div class="macro-row"><span class="macro-dot" style="background:var(--accent);"></span><span class="macro-row-label">Carboidrati</span><span class="macro-row-val">${Math.round(totals.c)} g</span></div>
    <div class="macro-row"><span class="macro-dot" style="background:#f0b429;"></span><span class="macro-row-label">Grassi</span><span class="macro-row-val">${Math.round(totals.f)} g</span></div>
  `;
}

// Card "Allenamento di oggi": mostra il giorno previsto per oggi dalla scheda attiva,
// o lo stato "già fatto"/"nessuna scheda" a seconda dei casi. Riusa WEEKDAYS/isoDaData
// già esistenti, stessa logica di riferimento di obiettivoSettimanale.
function aggiornaHomeCta(prof, programma){
  const eyebrow = document.getElementById('homeCtaEyebrow');
  const title = document.getElementById('homeCtaTitle');
  const meta = document.getElementById('homeCtaMeta');
  const btn = document.getElementById('homeCtaBtn');
  const card = document.getElementById('homeCtaCard');
  const addBtn = document.getElementById('homeCtaAddBtn');
  if(!eyebrow || !title || !meta || !btn || !card) return;
  card.classList.remove('home-cta-done');
  btn.dataset.azione = 'registra';
  if(addBtn) addBtn.style.display = 'none';
  if(!programma || !programma.days || programma.days.length===0){
    eyebrow.textContent = 'NESSUNA SCHEDA ATTIVA';
    title.textContent = 'Crea la tua prima scheda';
    meta.textContent = '';
    btn.textContent = 'Vai a Scheda';
    btn.dataset.azione = 'scheda';
    return;
  }
  const oggi = new Date();
  const wd = WEEKDAYS[oggi.getDay()];
  const giornoOggi = programma.days.find(dy=>dy.weekday===wd);
  const iso = isoDaData(oggi);
  const giaFatto = (prof.logs||[]).find(l=>l.date===iso && l.programId===programma.id && l.status==='registrato');
  if(!giornoOggi){
    eyebrow.textContent = 'OGGI';
    title.textContent = 'Giorno di riposo';
    meta.textContent = 'Nessun allenamento previsto per oggi';
    btn.textContent = 'Registra comunque un allenamento';
    return;
  }
  if(giaFatto){
    card.classList.add('home-cta-done');
    eyebrow.textContent = 'FATTO OGGI ✓';
    title.textContent = giornoOggi.name || 'Allenamento completato';
    meta.textContent = (giaFatto.exercises||[]).length + ' esercizi registrati';
    btn.textContent = 'Rivedi allenamento';
    // 31/08/2026 (quinto giro): "Rivedi allenamento" apriva Registra come se si
    // dovesse registrare di nuovo — segnalato che deve invece portare allo
    // Storico, dove l'allenamento appena fatto si può davvero rivedere.
    btn.dataset.azione = 'storico';
    if(addBtn) addBtn.style.display = 'block';
    return;
  }
  eyebrow.textContent = 'ALLENAMENTO DI OGGI';
  title.textContent = giornoOggi.name || 'Allenamento';
  const nomiEsercizi = (giornoOggi.exercises||[]).length;
  meta.textContent = nomiEsercizi>0 ? `${nomiEsercizi} esercizi` : '';
  btn.textContent = 'Inizia allenamento';
}

