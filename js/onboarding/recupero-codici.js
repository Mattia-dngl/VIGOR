// ============================================================
// SICUREZZA DEI DATI
// I dati stanno solo in questo telefono: chiediamo al sistema di non
// cancellarli e diamo una via di rientro se la password viene dimenticata.
// ============================================================
async function chiediProtezioneDati(){
  try{
    if(!navigator.storage || !navigator.storage.persist) return null;
    if(await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  }catch(e){ return null; }
}
async function statoProtezione(){
  try{
    if(!navigator.storage || !navigator.storage.persisted) return null;
    return await navigator.storage.persisted();
  }catch(e){ return null; }
}
async function spazioUsato(){
  try{
    if(!navigator.storage || !navigator.storage.estimate) return null;
    const s = await navigator.storage.estimate();
    return s && s.usage ? s.usage : null;
  }catch(e){ return null; }
}

async function aggiornaStatoDati(){
  const p = document.getElementById('statoPersistenza');
  const s = document.getElementById('statoSpazio');
  if(!p) return;

  const protetto = await statoProtezione();
  if(protetto === null){ p.textContent = "non disponibile qui"; p.className = ""; }
  else if(protetto){ p.textContent = "attiva"; p.className = "ok"; }
  else { p.textContent = "non attiva"; p.className = "warn"; }
  document.getElementById('proteggiBtn').style.display = (protetto === false) ? 'block' : 'none';

  const uso = await spazioUsato();
  s.textContent = uso ? pesoLeggibile(uso) : "non disponibile";
}


// ---------- schermata del codice appena creato il profilo ----------
let _profiloDaAprire = null;
function mostraCodiceRecupero(codice, profId, subito){
  _profiloDaAprire = subito === false ? null : profId;
  const avviso = document.getElementById('avvisoApprovazione');
  if(avviso) avviso.style.display = (subito === false) ? 'block' : 'none';
  document.getElementById('codiceFattoBtn').textContent = (subito === false) ? "Ho capito" : "Continua";
  document.getElementById('codiceRecupero').textContent = codice;
  document.getElementById('codiceSalvato').checked = false;
  document.getElementById('codiceFattoBtn').disabled = true;
  document.getElementById('gateSelectView').style.display = 'none';
  document.getElementById('gatePasswordView').style.display = 'none';
  document.getElementById('gateCodiceView').style.display = 'block';
}
document.getElementById('codiceSalvato').addEventListener('change', (e)=>{
  document.getElementById('codiceFattoBtn').disabled = !e.target.checked;
});
document.getElementById('copiaCodiceBtn').addEventListener('click', async ()=>{
  const ok = await copiaNegliAppunti(document.getElementById('codiceRecupero').textContent);
  toast(ok ? "Codice copiato ✓ incollalo nelle note" : "Tieni premuto sul codice per copiarlo");
});
document.getElementById('codiceFattoBtn').addEventListener('click', ()=>{
  document.getElementById('gateCodiceView').style.display = 'none';
  if(_profiloDaAprire){ enterProfile(_profiloDaAprire); _profiloDaAprire = null; }
  else { showGateSelectView(); renderProfileGate(); }
});

// ---------- rientro con il codice di recupero ----------
document.getElementById('pwDimenticataBtn').addEventListener('click', ()=>{
  const box = document.getElementById('recuperoBox');
  const aperto = box.style.display === 'block';
  box.style.display = aperto ? 'none' : 'block';
  document.getElementById('pwDimenticataBtn').textContent = aperto ? "Password dimenticata?" : "Annulla";
  if(!aperto){
    document.getElementById('recuperoCodice').value = "";
    document.getElementById('recuperoPw1').value = "";
    document.getElementById('recuperoPw2').value = "";
    document.getElementById('recuperoErr').style.display = 'none';
  }
});
document.getElementById('recuperoBtn').addEventListener('click', ()=>{
  const prof = state.profiles.find(p=>p.id===pendingProfileId);
  const err = document.getElementById('recuperoErr');
  const mostraErrore = (t)=>{ err.textContent = t; err.style.display = 'block'; };
  if(!prof) return;
  if(!prof.recuperoHash){
    mostraErrore("Questo profilo non ha un codice di recupero: è stato creato prima che esistesse.");
    return;
  }
  const codice = normalizzaCodice(document.getElementById('recuperoCodice').value);
  const pw1 = document.getElementById('recuperoPw1').value;
  const pw2 = document.getElementById('recuperoPw2').value;
  if(simpleHash(codice) !== prof.recuperoHash){ mostraErrore("Codice non valido."); return; }
  if(pw1.length < 4){ mostraErrore("La password deve avere almeno 4 caratteri."); return; }
  if(pw1 !== pw2){ mostraErrore("Le due password non coincidono."); return; }
  prof.passwordHash = simpleHash(pw1);
  save();
  err.style.display = 'none';
  document.getElementById('recuperoBox').style.display = 'none';
  document.getElementById('pwDimenticataBtn').textContent = "Password dimenticata?";
  toast("Password reimpostata ✓");
  enterProfile(prof.id);
});

// ---------- codice di recupero (generazione) ----------
function generaCodice(){
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // niente O/0 e I/1: si confondono
  let out = "";
  for(let i=0;i<8;i++){
    out += alfabeto[Math.floor(Math.random()*alfabeto.length)];
    if(i===3) out += "-";
  }
  return out;
}
function normalizzaCodice(s){ return (s||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }

document.getElementById('proteggiBtn').addEventListener('click', async ()=>{
  const esito = await chiediProtezioneDati();
  toast(esito ? "Protezione attivata ✓" : "Il browser non l'ha concessa.");
  aggiornaStatoDati();
});
document.getElementById('nuovoCodiceBtn').addEventListener('click', ()=>{
  const prof = loggedInProfile();
  if(!prof) return;
  customConfirm("Generare un nuovo codice di recupero? Quello vecchio smetterà di funzionare.", ()=>{
    const codice = generaCodice();
    prof.recuperoHash = simpleHash(normalizzaCodice(codice));
    save();
    const box = document.getElementById('codiceMostrato');
    box.textContent = codice;
    box.style.display = 'block';
    toast("Nuovo codice generato — salvalo");
  });
});

// ============================================================
// GIORNI SALTATI — registrazione automatica (anche retroattiva)
// Segna come "saltato" ogni giorno gia' passato che era previsto dalla scheda
// e per cui non esiste nessuna registrazione. Non tocca mai il giorno di oggi.
// ============================================================
function isoDaData(d){
  // ancoro a mezzogiorno: evita che il fuso orario faccia slittare la data di un giorno
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  return x.toISOString().slice(0,10);
}
function autoSkipAttivo(){
  const prof = loggedInProfile();
  return !prof || prof.autoSkip !== false;   // attivo salvo scelta contraria
}
function autoRegistraSaltati(){
  if(!autoSkipAttivo()) return 0;
  const prof = activeProfile();
  const p = activeProgram();
  if(!prof || !p || !p.days || p.days.length===0) return 0;
  // se la scheda non ha giorni fissati in settimana non c'e' nulla da dedurre
  if(!p.days.some(d=>d.weekday)) return 0;

  const oggi = new Date();
  // un giorno di margine prima di segnare "saltato": così se ti alleni la sera
  // e registri solo il giorno dopo, non lo trovi già segnato come perso
  const sogliaIso = isoDaData(new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()-1));

  // si parte dalla creazione della scheda, o dal primo allenamento se precedente
  let daIso = p.createdAt || sogliaIso;
  const primo = prof.logs.filter(l=>l.programId===p.id).map(l=>l.date).sort()[0];
  if(primo && primo < daIso) daIso = primo;
  if(daIso >= sogliaIso) return 0;

  const cur = new Date(daIso + "T12:00:00");
  let aggiunti = 0, giro = 0;
  while(isoDaData(cur) < sogliaIso && giro++ < 800){
    const iso = isoDaData(cur);
    const previsto = p.days.find(d=>d.weekday === WEEKDAYS[cur.getDay()]);
    const scartato = prof.autoSkipIgnorati && prof.autoSkipIgnorati.includes(iso);
    if(previsto && !scartato && !prof.logs.some(l=>l.date===iso && l.programId===p.id)){
      prof.logs.push({
        id: uid(), date: iso, programId: p.id, status: "saltato",
        dayKey: null, dayName: null, exercises: [], notes: "", auto: true
      });
      aggiunti++;
    }
    cur.setDate(cur.getDate()+1);
  }
  if(aggiunti>0){
    prof.logs.sort((a,b)=>a.date.localeCompare(b.date));
    save();
  }
  return aggiunti;
}

let _autoSkipFatto = null;   // evita di ricontrollare piu' volte nello stesso giorno
function controllaSaltati(avvisa){
  const prof = activeProfile();
  if(!prof) return;
  const oggiIso = isoDaData(new Date());
  const chiave = prof.id + "|" + oggiIso;
  if(_autoSkipFatto === chiave) return;
  _autoSkipFatto = chiave;
  const n = autoRegistraSaltati();
  if(n>0 && avvisa){
    toast(n===1 ? "1 giorno non registrato segnato come saltato"
                : `${n} giorni non registrati segnati come saltati`);
  }
}




// ============================================================
