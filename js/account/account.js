// ============================================================
// NAVIGAZIONE GLOBALE — barra persistente a 5 voci (Scheda, Dieta, Home,
// Account, Glossario). Riusa senza modificarle le funzioni già esistenti
// (mostraHome, apriAccountPanel, il click sui vecchi .tab-btn dentro
// appRoot) invece di reimplementare la logica di cambio schermata.
// ============================================================
function showAppRoot(){
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('accountPanel').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
  // Storico li nasconde apposta (vedi apriStorico()): rientrando in una
  // qualunque altra schermata (Scheda/Registra/Dieta) tornano visibili — a
  // meno che si stia rientrando su Scheda con "Modifica scheda" ancora
  // aperta (es. tornati da Dieta): in quel caso restano nascosti, stessa
  // logica di aggiornaChromeSchedaEditor() ma senza richiamare anche
  // renderMioPT() ad ogni singola navigazione (quella resta legata solo al
  // tasto che fa uscire davvero dall'editor — vedi il toggle .seg-btn[data-seg]).
  const inEditScheda = document.getElementById('programEditBlock')?.style.display === 'block';
  const sticky = document.querySelector('.sticky-top');
  if(sticky) sticky.style.display = inEditScheda ? 'none' : '';
  document.body.classList.toggle('scheda-editor-aperto', inEditScheda);
  // Registra (26/08/2026, ventiduesimo giro) ha la sua intestazione a sé:
  // rientrando in una QUALUNQUE altra schermata la classe va tolta, la
  // rimette apriRegistra() stessa se e quando si torna lì.
  document.body.classList.remove('registra-aperto');
}
function vaiA(tab){
  if(tab === 'home'){ mostraHome(); return; }
  if(tab === 'account'){ apriAccountPanel(); return; }
  if(tab === 'storico'){ apriStorico(); return; }
  showAppRoot();
  const legacyBtn = document.querySelector('#navTabsLegacy .tab-btn[data-tab="'+tab+'"]');
  if(legacyBtn) legacyBtn.click();
  if(tab === 'program'){
    // Storico ha ora una voce a sé nella nav: arrivando su Scheda mi assicuro
    // che si apra sempre sulla scheda vera, non sull'ultimo stato dello Storico
    // lasciato da una visita precedente.
    document.getElementById('programSchedaBlock').style.display = 'block';
    document.getElementById('programStoricoBlock').style.display = 'none';
    document.querySelectorAll('.seg-btn[data-segprog]').forEach(b=>
      b.classList.toggle('active', b.dataset.segprog === 'scheda'));
  }
}
// Apre Registra direttamente (usato dalla CTA in Home e dal giorno di oggi in Scheda).
// Concettualmente "Registra" fa parte del flusso Scheda: nella nav nuova resta
// evidenziato "Scheda" anche mentre si registra un allenamento.
function apriRegistra(){
  showAppRoot();
  const legacyBtn = document.querySelector('#navTabsLegacy .tab-btn[data-tab="log"]');
  if(legacyBtn) legacyBtn.click();
  aggiornaNavGlobale('program');
  // Registra come pagina a sé (26/08/2026, ventiduesimo giro): nascondo
  // l'intestazione condivisa .sticky-top e la nav in basso DOPO
  // showAppRoot() (che le ha appena rimesse a posto in generale) — stesso
  // ordine già usato da apriStorico(). L'unico modo per uscire da qui resta
  // il tasto dedicato #registraTornaSchedaBtn.
  const sticky = document.querySelector('.sticky-top');
  if(sticky) sticky.style.display = 'none';
  document.body.classList.add('registra-aperto');
}
document.getElementById('registraTornaSchedaBtn').addEventListener('click', ()=>vaiA('program'));
// Storico: stesso contenuto che vive dentro Scheda (programStoricoBlock), ma ora
// raggiungibile direttamente dalla nav come voce a sé — non serve più passare da
// Scheda e toccare il toggle interno per arrivarci.
function apriStorico(){
  showAppRoot();
  const legacyBtn = document.querySelector('#navTabsLegacy .tab-btn[data-tab="program"]');
  if(legacyBtn) legacyBtn.click();
  document.getElementById('programSchedaBlock').style.display = 'none';
  document.getElementById('programStoricoBlock').style.display = 'block';
  document.querySelectorAll('.seg-btn[data-segprog]').forEach(b=>
    b.classList.toggle('active', b.dataset.segprog === 'storico'));
  try{ renderHistory(); renderVolume(); renderMeasurements(); renderCalendarioStorico(); }catch(e){ console.error(e); }
  aggiornaNavGlobale('storico');
  // Il nuovo Storico (mockup, 25/08 sedicesimo giro) vuole il calendario come
  // prima cosa in vista: nascondo qui l'intestazione legacy "Registro
  // Allenamento" e la card "Il mio Personal Trainer", condivise con
  // Scheda/Registra/Dieta — showAppRoot() le rimette a posto tornando altrove
  // (richiesta esplicita, 25/08 diciassettesimo giro).
  const sticky = document.querySelector('.sticky-top');
  if(sticky) sticky.style.display = 'none';
  const cardPT = document.getElementById('cardMioPT');
  if(cardPT) cardPT.style.display = 'none';
}
function aggiornaNavGlobale(attivo){
  // 'log' non ha una voce propria nella nav nuova: nesta concettualmente sotto
  // Scheda, quindi evidenzio comunque "Scheda".
  const mappa = { log:'program' };
  const finale = mappa[attivo] || attivo;
  document.querySelectorAll('#navTabsGlobale button[data-go]').forEach(b=>{
    b.classList.toggle('active', b.dataset.go === finale);
  });
}

// Impostazioni è una schermata a sé (#settingsPanel, redesign ispirato ai
// social — 31/08/2026 terzo giro): raccoglie Password e sicurezza,
// Allenamento e dati (timer/promemoria/esercizi), Assistenza e Gestione
// dell'app, così la schermata principale di Account resta con solo le
// funzioni più importanti. "provenienza" dice a chiudiSettingsPanel() dove
// tornare: 'account' = si torna ad Account (ci si è arrivati con
// l'ingranaggio ⚙ lì dentro), 'app' = torna alla schermata di app da cui si
// è aperta Impostazioni, altrimenti si torna in Home.
function apriImpostazioni(provenienza){
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('accountPanel').style.display = 'none';
  document.getElementById('settingsPanel').style.display = 'block';
  _impostazioniProvenienza = provenienza;
  renderImpostazioniInline();
  renderAmministrazione();
  const acc = document.getElementById('accImpostazioni');
  if(acc){ acc.open = true; if(acc.scrollIntoView) acc.scrollIntoView({behavior:'smooth', block:'start'}); }
}
// Chiude #settingsPanel tornando a dove si è aperta (vedi apriImpostazioni).
function chiudiSettingsPanel(){
  document.getElementById('settingsPanel').style.display = 'none';
  if(_impostazioniProvenienza === 'app'){
    _impostazioniProvenienza = null;
    document.getElementById('appRoot').style.display = 'block';
    return;
  }
  if(_impostazioniProvenienza === 'account'){
    _impostazioniProvenienza = null;
    apriAccountPanel();
    return;
  }
  _impostazioniProvenienza = null;
  mostraHome();
}
document.getElementById('openSettingsBtn').addEventListener('click', ()=>apriImpostazioni('account'));
document.getElementById('closeSettingsBtn').addEventListener('click', chiudiSettingsPanel);
// Riempie i campi della tendina Impostazioni: usata sia da apriImpostazioni()
// (ingranaggio ⚙, notifiche) sia dal 'toggle' della tendina stessa quando la
// si apre toccandola direttamente dentro Account.
function renderImpostazioniInline(){
  aggiornaStatoDati();
  renderImpostazioniTimer();
  renderPromemoria();
  const _lpAuto = loggedInProfile();
  document.getElementById('autoSkipToggle').checked = !_lpAuto || _lpAuto.autoSkip !== false;
  document.getElementById('codiceMostrato').style.display = 'none';

  const canManage = canManageExercises();
  // 31/08/2026: testo accorciato (era un doppio periodo lungo) — l'informazione
  // essenziale ("condiviso" vs "personale") resta, il resto è nei singoli tasti sotto.
  document.getElementById('exSectionsIntro').innerHTML = puoModificareSistema()
    ? '<b>Gli esercizi di base sono condivisi</b> tra tutti gli account, quelli che aggiungi qui sotto restano personali.'
    : 'Qui aggiungi <b>i tuoi esercizi personali</b> (visibili solo a te). La libreria di base è condivisa.';
  document.getElementById('exSectionsIntro').style.display = 'block';
  document.getElementById('addExCard').style.display = canManage ? 'block' : 'none';
  document.getElementById('customExVideoField').style.display = 'block';
  document.getElementById('myExCard').style.display = canManage ? 'block' : 'none';
  document.getElementById('noExPermCard').style.display = canManage ? 'none' : 'block';
  document.getElementById('baseExCard').style.display = puoModificareSistema() ? 'block' : 'none';
  if(canManage){
    riempiTendinaTipi();
    renderCustomExMuscleChips();
    renderCustomExList();
    renderBaseExerciseList();
  }
}
function apriAccountPanel(){
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('accountPanel').style.display = 'block';
  document.body.classList.add('account-aperto');
  aggiornaNavGlobale('account');
  const lp = loggedInProfile();
  if(!lp) return;
  document.getElementById('accountNameInput').value = lp.name;
  document.getElementById('accountEmailMostrata').textContent = lp.email || "non impostata";
  document.getElementById('accountOldPw').value = "";
  document.getElementById('accountNewPw').value = "";
  document.getElementById('accountNewPw2').value = "";
  document.querySelectorAll('#setSesso .seg-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.val === lp.sesso);
  });
  document.getElementById('setDataNascita').value = lp.dataNascita || '';
  document.getElementById('setAltezza').value = lp.altezza || '';
  document.getElementById('setLivelloAttivita').value = lp.livelloAttivita || 'moderato';
  renderEtaCalcolata();
  renderAbbonamento(lp);

  document.getElementById('acctAvatarInitials').textContent = inizialiNome(lp.name);
  document.getElementById('acctHeaderName').textContent = lp.name || "Senza nome";
  document.getElementById('acctHeaderEmail').textContent = lp.email || "email non impostata";
  aggiornaAvatarHeader(lp);
  const badge = document.getElementById('acctHeaderBadge');
  if(sonoAmministratore()){ badge.textContent = "Amministratore"; badge.classList.add('show'); }
  else if(sonoPT()){ badge.textContent = "Personal Trainer"; badge.classList.add('show'); }
  else { badge.classList.remove('show'); }

  // Messaggi ha senso solo con un account online: in locale non c'è un
  // server con cui parlare. "Password e sicurezza" invece vive ora dentro
  // Impostazioni e resta sempre raggiungibile (online o offline mostra
  // internamente il blocco giusto — vedi il 'toggle' di #accPrivacy).
  document.getElementById('acctVaiMessaggi').style.display = utenteOnline ? 'flex' : 'none';
}

// Segnaposto per una funzione futura: oggi nessuna palestra è collegata
// all'app, quindi lp.abbonamentoScadenza è sempre null e la card lo dice
// esplicitamente. Appena una palestra imposterà questa data da qualche
// parte (gestione PT/admin, non ancora costruita), la stessa card mostrerà
// da sola data e badge di stato senza bisogno di altre modifiche qui.
function renderAbbonamento(lp){
  const badge = document.getElementById('abbonamentoBadge');
  const valore = document.getElementById('abbonamentoScadenzaMostrata');
  const hint = document.getElementById('abbonamentoHint');
  const scadenza = lp && lp.abbonamentoScadenza;
  if(!scadenza){
    badge.style.display = 'none';
    valore.textContent = '—';
    hint.textContent = "Non ancora collegato: appena la tua palestra lo attiva, qui vedrai in automatico quando scade il tuo abbonamento.";
    return;
  }
  const giorni = giorniDaOggi(scadenza);
  valore.textContent = formatDate(scadenza);
  badge.style.display = 'inline-block';
  if(giorni !== null && giorni > 0){
    badge.className = 'membership-badge low'; badge.textContent = 'Scaduto';
    hint.textContent = "Il tuo abbonamento è scaduto: parla con la tua palestra per rinnovarlo.";
  } else if(giorni !== null && giorni > -7){
    badge.className = 'membership-badge warn'; badge.textContent = 'In scadenza';
    hint.textContent = "Sta per scadere: rinnovalo per continuare ad allenarti senza interruzioni.";
  } else {
    badge.className = 'membership-badge ok'; badge.textContent = 'Attivo';
    hint.textContent = "Il tuo abbonamento è attivo.";
  }
}

// Icona chat riusata al posto dell'emoji 💬 nei bottoni "Messaggi", per restare
// coerenti con lo stile a icone SVG del resto dell'app.
const ICONA_CHAT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; vertical-align:-2px; margin-right:4px;" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>';

// Iniziali (max 2 lettere) da un nome — usate per l'avatar quando non c'è una foto.
function inizialiNome(nome){
  const pulite = (nome || "?").trim().split(/\s+/).map(p=>p[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
  return pulite || "?";
}
// Markup da mettere DENTRO un contenitore già con classe .acct-avatar o .pt-avatar:
// foto se c'è, altrimenti iniziali colorate.
function avatarContentHtml(nome, avatarUrl){
  return avatarUrl ? `<img src="${avatarUrl}" alt="">` : inizialiNome(nome);
}
// Aggiorna l'avatar grande nell'header di Account, passando da iniziali a foto e viceversa.
function aggiornaAvatarHeader(prof){
  const circle = document.getElementById('acctAvatarCircle');
  const initialsEl = document.getElementById('acctAvatarInitials');
  let img = circle.querySelector('img');
  if(prof.avatarUrl){
    if(!img){ img = document.createElement('img'); img.alt = ''; circle.insertBefore(img, initialsEl); }
    img.src = prof.avatarUrl;
    img.style.display = 'block';
    initialsEl.style.display = 'none';
  } else {
    if(img) img.style.display = 'none';
    initialsEl.style.display = '';
  }
}
// Foto profilo: ridimensiono e comprimo lato telefono (max 240x240, jpeg) e la salvo
// direttamente nel profilo, come già facciamo per gli alimenti/esercizi personalizzati.
// Niente spazio di archiviazione online da configurare: funziona subito.
document.getElementById('acctAvatarFile').addEventListener('change', function(e){
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if(!file) return;
  if(!file.type || !file.type.startsWith('image/')){ toast("Scegli un file immagine."); return; }
  const reader = new FileReader();
  reader.onload = function(ev){
    const img = new Image();
    img.onload = function(){
      const lato = 240;
      const canvas = document.createElement('canvas');
      canvas.width = lato; canvas.height = lato;
      const ctx = canvas.getContext('2d');
      const scala = Math.max(lato / img.width, lato / img.height);
      const w = img.width * scala, h = img.height * scala;
      ctx.drawImage(img, (lato - w) / 2, (lato - h) / 2, w, h);
      const prof = loggedInProfile();
      if(!prof) return;
      prof.avatarUrl = canvas.toDataURL('image/jpeg', 0.72);
      save();
      aggiornaAvatarHeader(prof);
      toast("Foto profilo aggiornata ✓");
    };
    img.onerror = function(){ toast("Non riesco a leggere questa immagine."); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});
function chiudiAccountPanel(){
  document.getElementById('accountPanel').style.display = 'none';
  document.body.classList.remove('account-aperto');
  mostraHome();
}

document.getElementById('homeCtaBtn').addEventListener('click', ()=>{
  const btn = document.getElementById('homeCtaBtn');
  if(btn.dataset.azione === 'scheda'){ vaiA('program'); }
  else if(btn.dataset.azione === 'storico'){ apriStorico(); }
  else { apriRegistra(); }
});
document.getElementById('homeCtaAddBtn').addEventListener('click', ()=>{
  apriRegistra();
  selectDay('LIBERO');
});
document.getElementById('homeAllenatiBtn').addEventListener('click', ()=>vaiA('program'));
document.getElementById('homePTBtn').addEventListener('click', ()=>apriAreaPT());
document.getElementById('homeAvatarBtn').addEventListener('click', apriAccountPanel);
document.getElementById('homeSchedaAttivaCard').addEventListener('click', ()=>vaiA('program'));
document.getElementById('homeEsciBtn').addEventListener('click', async ()=>{
  customConfirm("Uscire dall'app? Dovrai rifare l'accesso.", async ()=>{
    // il bottone vive dentro Account: lo richiudo sempre anch'esso, altrimenti
    // resterebbe visibile sopra la schermata di accesso dopo l'uscita
    document.getElementById('accountPanel').style.display = 'none';
    document.body.classList.remove('account-aperto');
    if(modalitaOnline() && sb){
      if(_canaleMioProfilo){ sb.removeChannel(_canaleMioProfilo); _canaleMioProfilo = null; }
      await sb.auth.signOut();
      utenteOnline = null; rigaOnline = null;
      activeProfileId = null;
      document.getElementById('homeScreen').style.display = 'none';
      mostraCloudGate('accedi');
      return;
    }
    actingProfileId = null;
    document.getElementById('homeScreen').style.display = 'none';
    document.getElementById('profileGate').style.display = 'flex';
    renderProfileGate();
  });
});
document.getElementById('closeAccountBtn').addEventListener('click', chiudiAccountPanel);

// ---------- righe/tendine di Account e Impostazioni (Allenamento/Glossario/Messaggi/Password/Assistenza) ----------
// L'evento nativo 'toggle' di <details> copre sia l'apertura diretta (click
// sulla riga) sia l'apertura via apriImpostazioni() (usata dall'ingranaggio
// ⚙ e da chi arriva da una notifica).
document.getElementById('accImpostazioni').addEventListener('toggle', function(){
  if(this.open) renderImpostazioniInline();
});
document.getElementById('accGlossario').addEventListener('toggle', function(){
  if(this.open) renderGlossario();
});

async function apriMessaggiGenerico(){
  if(!utenteOnline){ toast("Disponibile solo con un account online."); return; }
  const mie = (_rapporti||[]).filter(r => r.stato === 'attivo');
  if(mie.length === 0){
    toast("Nessuna conversazione: serve un Personal Trainer che ti segue, o un cliente che segui.");
    return;
  }
  const altriIds = mie.map(r => r.cliente_id === utenteOnline.id ? r.pt_id : r.cliente_id);
  const { data, error } = await sb.from('profili').select('id,nome,nome_pubblico,email').in('id', altriIds);
  if(error){ toast("Non riesco ad aprire i messaggi: " + error.message); return; }
  const persone = mie.map(r=>{
    const altroId = r.cliente_id === utenteOnline.id ? r.pt_id : r.cliente_id;
    return { rapportoId: r.id, altroId, profilo: (data||[]).find(p=>p.id===altroId) };
  }).filter(x=>x.profilo);

  if(persone.length === 1){
    const p = persone[0];
    apriMessaggi(p.rapportoId, p.altroId, nomeDi(p.profilo));
    return;
  }
  const box = document.getElementById('elencoConversazioni');
  box.innerHTML = persone.map(p=>`
    <div class="pt-riga">
      <div class="info"><div class="nome">${nomeDi(p.profilo)}</div><div class="meta">${p.profilo.email||''}</div></div>
      <div class="azioni"><button class="ok" data-vai="${p.rapportoId}">Apri</button></div>
    </div>`).join('');
  box.querySelectorAll('[data-vai]').forEach(b=>b.addEventListener('click', ()=>{
    const p = persone.find(x=>x.rapportoId === b.dataset.vai);
    document.getElementById('sceltaConversazioneOverlay').classList.remove('show');
    apriMessaggi(p.rapportoId, p.altroId, nomeDi(p.profilo));
  }));
  document.getElementById('sceltaConversazioneOverlay').classList.add('show');
}
document.getElementById('acctVaiMessaggi').addEventListener('click', apriMessaggiGenerico);
document.getElementById('sceltaConversazioneChiudi').addEventListener('click', ()=>
  document.getElementById('sceltaConversazioneOverlay').classList.remove('show'));
document.getElementById('sceltaConversazioneOverlay').addEventListener('click', e=>{
  if(e.target.id === 'sceltaConversazioneOverlay') e.currentTarget.classList.remove('show');
});

// ---------- Privacy e Sicurezza (solo account online: password vera + eliminazione account) ----------
// Ora è una tendina dentro Account: aggiorno l'email mostrata e ripulisco
// l'esito precedente ogni volta che si apre, invece di navigare altrove.
document.getElementById('accPrivacy').addEventListener('toggle', function(){
  if(!this.open) return;
  const online = !!utenteOnline;
  // Online: password vera gestita da Supabase, si cambia col link via email
  // (+ elimina account, che richiede un server). Offline: il profilo locale
  // ha una password propria (accountOldPw/New/New2, ex "Nome e password"),
  // niente server con cui parlare per eliminare l'account da qui.
  document.getElementById('pwOnlineBlock').style.display = online ? '' : 'none';
  document.getElementById('pwEliminaBlock').style.display = online ? '' : 'none';
  document.getElementById('pwOfflineBlock').style.display = online ? 'none' : '';
  document.getElementById('privacyEmailMostrata').textContent = (utenteOnline && utenteOnline.email) || (loggedInProfile()||{}).email || '—';
  document.getElementById('privacyPwEsito').style.display = 'none';
});

document.getElementById('privacyCambiaPwBtn').addEventListener('click', async ()=>{
  const el = document.getElementById('privacyPwEsito');
  if(!utenteOnline || !sb){ el.style.color='var(--accent)'; el.textContent="Disponibile solo con un account online."; el.style.display='block'; return; }
  try{
    const { error } = await sb.auth.resetPasswordForEmail(utenteOnline.email, { redirectTo: location.origin + location.pathname });
    el.style.color = error ? 'var(--accent)' : 'var(--ok)';
    el.textContent = error ? traduciErrore(error.message) : "Email inviata ✓ apri il link che ti abbiamo mandato per scegliere la nuova password.";
  }catch(e){
    console.error(e);
    el.style.color = 'var(--accent)';
    el.textContent = traduciErrore(e && e.message);
  }
  el.style.display = 'block';
});

document.getElementById('privacyEliminaBtn').addEventListener('click', ()=>{
  if(!utenteOnline || !sb){ toast("Disponibile solo con un account online."); return; }
  customConfirm(
    "Eliminare per sempre il tuo account? Scheda, dieta, storico allenamenti e conversazioni verranno cancellati e non si torna indietro.",
    async ()=>{
      toast("Elimino il tuo account…");
      try{
        const { data, error } = await sb.functions.invoke('elimina-account');
        if(error || (data && data.error)){
          toast("Non riuscito: " + (error ? error.message : data.error));
          return;
        }
        await sb.auth.signOut();
        location.reload();
      }catch(e){
        console.error(e);
        toast("Non riuscito: " + (e.message || 'errore imprevisto'));
      }
    });
});

// Assistenza è statica (solo un link mailto): è già una tendina in HTML
// (#accAssistenza), non serve altro JS per aprirla/chiuderla.

// ---------- ingresso ----------
async function avvioOnline(){
  if(!iniziaSupabase()){
    document.getElementById('cloudCaricaTxt').textContent = "Configurazione non valida: controlla config.js.";
    document.getElementById('cloudRiprova').style.display = 'block';
    return false;
  }
  mostraStatoSync('sincronizzo', 'controllo…');
  // tornando dal link di conferma email o dal link "password dimenticata" l'indirizzo
  // contiene dei parametri: dopo averli usati (supabase-js li legge da solo) li tolgo,
  // così un aggiornamento della pagina non manda in errore. Il link di recovery ha
  // sempre "type=recovery" nell'hash: lo controllo SUBITO, prima di aspettare
  // l'evento onAuthStateChange (che a volte arriva dopo che ho già tolto i parametri).
  const eraLinkDiRecupero = location.hash.includes('type=recovery');
  if(eraLinkDiRecupero) _recuperoPasswordAttivo = true;
  if(location.hash.includes('access_token') || location.search.includes('code=')){
    await new Promise(r=>setTimeout(r, 400));
    history.replaceState(null, '', location.origin + location.pathname);
  }
  if(_recuperoPasswordAttivo){
    // Non porto MAI direttamente dentro l'app con una sessione di recupero:
    // prima va scelta la nuova password.
    mostraCloudGate('recovery');
    return true;
  }
  try{
    const { data } = await sb.auth.getSession();
    if(data && data.session){
      utenteOnline = data.session.user;
      await dopoAccessoOnline();
    } else {
      mostraCloudGate('accedi');
    }
  }catch(e){
    console.error(e);
    mostraStatoSync('offline', 'senza rete');
    mostraCloudGate('accedi');
  }
  return true;
}

async function dopoAccessoOnline(){
  // Ripristino difensivo: se una sessione precedente fosse rimasta bloccata
  // mentre modificavo la scheda/dieta di un cliente (chiusura imprevista,
  // ricarica pagina...), qui riparto sempre pulito — mai in "modalità PT"
  // appena entro nell'app.
  modalitaPT = false;
  _clienteBuffer = null;
  _clienteIdInModifica = null;
  _modificaPTCosa = null;
  _clienteAperto = null;
  document.body.classList.remove('modifica-pt', 'account-aperto', 'area-pt', 'impostazioni-aperte');

  mostraStatoSync('sincronizzo', 'carico i dati…');
  try{
    // Timeout di sicurezza: se il server non risponde entro 15 secondi mi
    // arrendo e mostro un errore con cui si può riprovare, invece di lasciare
    // la persona a guardare l'indicatore girare all'infinito senza nessuna
    // via d'uscita — bug segnalato il 25/08/2026 testando il blocco di un
    // account: se questa chiamata falliva (o restava appesa) mentre si era
    // ancora sulla schermata "Connessione…" (es. dopo il ricaricamento
    // automatico di un account appena bloccato), l'errore veniva sì mostrato,
    // ma sotto al campo email della schermata di login — che però non era
    // quella visibile in quel momento, quindi restava invisibile e la
    // persona vedeva "Connessione…" per sempre.
    let _timeoutId;
    const risposta = await Promise.race([
      sb.from('profili').select('*').eq('id', utenteOnline.id).maybeSingle(),
      new Promise((_, rifiuta) => { _timeoutId = setTimeout(()=>rifiuta(new Error('Tempo scaduto: il server non risponde. Controlla la connessione e riprova.')), 15000); })
    ]);
    clearTimeout(_timeoutId);
    const { data, error } = risposta;
    if(error) throw error;

    if(!data){
      // prima volta su questo account: creo la riga (parte non approvata)
      const nuova = {
        id: utenteOnline.id,
        email: utenteOnline.email,
        nome: (utenteOnline.user_metadata && utenteOnline.user_metadata.nome) || utenteOnline.email.split('@')[0],
        approvato: (utenteOnline.email || '').toLowerCase() === EMAIL_AMMINISTRATORE,
        dati: profiloVuotoPerCloud()
      };
      const res = await sb.from('profili').insert(nuova).select().maybeSingle();
      if(res.error) throw res.error;
      rigaOnline = res.data || nuova;
    } else {
      rigaOnline = data;
    }

    if(!rigaOnline.approvato){
      if(rigaOnline.bloccato){
        mostraAccountBloccatoOverlay({ testoAzione:'Esci', suAzione: async ()=>{
          if(_canaleMioProfilo){ sb.removeChannel(_canaleMioProfilo); _canaleMioProfilo = null; }
          await sb.auth.signOut();
          utenteOnline = null; rigaOnline = null;
          mostraCloudGate('accedi');
        }});
        mostraStatoSync('offline', 'bloccato');
        return;
      }
      document.getElementById('cloudAttesaTxt').textContent =
        `L'account ${rigaOnline.email} è stato creato, ma chi gestisce l'app deve ancora approvarlo. Appena lo fa, entri con questa stessa password.`;
      mostraCloudGate('attesa');
      mostraStatoSync('offline', 'in attesa');
      return;
    }

    // porto i dati online dentro il motore locale dell'app
    applicaDatiOnline();
    // la card per l'area riservata compare solo a chi è Personal Trainer
    document.getElementById('homePTBtn').style.display = sonoPT() ? 'flex' : 'none';
    caricaRapporti().then(()=>{ renderMioPT(); aggiornaCampanellaHome(); }).catch(()=>{});
    ascoltaMioProfilo();
    document.documentElement.classList.remove('avvio');
    nascondiCloudGate();
    controllaSaltati(true);
    renderAll();
    _timerDurata = impostazioniTimer().durata;
    renderScorciatoieTimer();
    _bozzaPronta = false;
    if(ripristinaBozza()) toast("Ripresa la registrazione lasciata a metà");
    _bozzaPronta = true;
    mostraStatoSync('ok', 'sincronizzato');
    // Chi è Personal Trainer entra direttamente nella sua area riservata:
    // non è un utente come gli altri, non deve passare dalla home normale
    // (da lì può comunque tornare alla propria home col tasto "Torna Home").
    if(sonoPT()) apriAreaPT();
    else mostraHome();
  }catch(e){
    // Qualunque errore qui (rete, timeout, server) non deve lasciare la
    // persona bloccata a guardare l'indicatore girare per sempre: torna
    // sempre alla schermata di login, dove l'errore È visibile, con la
    // possibilità di riprovare.
    console.error(e);
    mostraStatoSync('offline', 'senza rete');
    mostraCloudGate('accedi');
    mostraErroreAccesso((e && e.message) || 'Qualcosa non ha funzionato. Riprova.');
  }
}

function profiloVuotoPerCloud(){
  const p = newProfile('', '', 'segnaposto', true);
  delete p.passwordHash;   // la password la gestisce Supabase, non l'app
  return p;
}

function applicaDatiOnline(){
  const dati = normalizzaProfilo(rigaOnline.dati || profiloVuotoPerCloud());
  dati.id = rigaOnline.id;
  dati.name = rigaOnline.nome || dati.name || 'Io';
  dati.email = rigaOnline.email;
  dati.approvato = true;
  state.profiles = [dati];
  activeProfileId = dati.id;
  actingProfileId = null;
  salvaLocale();
}

// ---------- salvataggio ----------
function salvaLocale(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }

async function inviaOnline(){
  if(!sb || !utenteOnline || !rigaOnline) return;
  const mio = state.profiles.find(p=>p.id === activeProfileId);
  if(!mio) return;
  mostraStatoSync('sincronizzo', 'salvo…');
  const { error } = await sb.from('profili')
    .update({ dati: mio, nome: mio.name, aggiornato_il: new Date().toISOString() })
    .eq('id', utenteOnline.id);
  if(error){
    console.error(error);
    _daSincronizzare = true;
    mostraStatoSync('offline', 'salvo appena torna la rete');
  } else {
    _daSincronizzare = false;
    mostraStatoSync('ok', 'sincronizzato');
  }
}
function programmaInvio(){
  if(!modalitaOnline() || !utenteOnline) return;
  clearTimeout(_salvataggioInCorso);
  _salvataggioInCorso = setTimeout(inviaOnline, 1200);   // accorpa le modifiche ravvicinate
}
// quando torna la rete recupero quello che non era passato
window.addEventListener('online', ()=>{ if(_daSincronizzare) inviaOnline(); });
window.addEventListener('offline', ()=>mostraStatoSync('offline', 'senza rete'));

// ---------- pulsanti ----------
function mostraErroreAccesso(msg){
  const el = document.getElementById('cloudErr');
  el.textContent = traduciErrore(msg);
  el.style.display = 'block';
}
function traduciErrore(m){
  const t = (m||'').toLowerCase();
  if(t.includes('invalid login')) return "Email o password non corrette.";
  if(t.includes('already registered') || t.includes('already been registered')) return "Esiste già un account con questa email.";
  if(t.includes('password should be')) return "La password deve avere almeno 8 caratteri.";
  if(t.includes('email not confirmed')) return "Devi confermare l'email: controlla la posta.";
  if(t.includes('failed to fetch') || t.includes('networkerror')) return "Nessuna connessione: riprova quando hai rete.";
  // Qualunque altro messaggio che sembri un errore tecnico "grezzo" (uscito
  // da una libreria minificata, un blocco try/catch mancante, ecc. — es.
  // "null is not an object (evaluating 'x.y')" visto in Safari dopo un
  // cambio password) non va mai mostrato così com'è: nessuno capirebbe cosa
  // fare. Meglio un messaggio generico ma comprensibile, con cui si può
  // comunque riprovare.
  const sembraErroreTecnico = !t || /is not an object|is not a function|evaluating|undefined is not|cannot read propert|null is not|object object|\bnan\b/.test(t);
  if(sembraErroreTecnico) return "Qualcosa non ha funzionato. Riprova tra poco.";
  return m;
}

document.getElementById('cloudVaiRegistra').addEventListener('click', ()=>mostraCloudGate('registra'));
document.getElementById('cloudVaiAccedi').addEventListener('click', ()=>mostraCloudGate('accedi'));

document.getElementById('cloudEntraBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('cloudEmail').value.trim().toLowerCase();
  const pw = document.getElementById('cloudPw').value;
  document.getElementById('cloudErr').style.display = 'none';
  if(!emailValida(email) || !pw){ mostraErroreAccesso("Inserisci email e password."); return; }
  try{
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if(error){ mostraErroreAccesso(error.message); return; }
    utenteOnline = data.user;
    await dopoAccessoOnline();
  }catch(e){
    // Qualunque eccezione imprevista qui (anche dentro la libreria di
    // autenticazione, non solo nostra) non deve lasciare la persona davanti
    // a un testo tecnico incomprensibile: si vede un errore normale, con cui
    // può riprovare — mai bloccata sulla schermata di accesso senza spiegazioni.
    console.error(e);
    mostraErroreAccesso(e && e.message);
  }
});

document.getElementById('regBtn').addEventListener('click', async ()=>{
  const nome = document.getElementById('regNome').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const pw = document.getElementById('regPw').value;
  const err = document.getElementById('regErr');
  err.style.display = 'none';
  if(!nome){ err.textContent = "Inserisci il tuo nome."; err.style.display='block'; return; }
  if(!emailValida(email)){ err.textContent = "Inserisci un'email valida."; err.style.display='block'; return; }
  if(pw.length < 8){ err.textContent = "La password deve avere almeno 8 caratteri."; err.style.display='block'; return; }
  try{
    // l'email di conferma deve riportare esattamente a questa pagina, altrimenti si finisce su un 404
    const ritorno = location.origin + location.pathname;
    const { data, error } = await sb.auth.signUp({
      email, password: pw,
      options:{ data:{ nome }, emailRedirectTo: ritorno }
    });
    if(error){ err.textContent = traduciErrore(error.message); err.style.display='block'; return; }
    if(data.session){
      utenteOnline = data.user;
      await dopoAccessoOnline();
    } else {
      // niente sessione = serve confermare l'email: porto subito su Accedi con un avviso ben visibile,
      // invece di lasciare la persona sulla schermata di registrazione con un testo piccolo
      mostraCloudGate('accedi');
      document.getElementById('confermaEmailIndirizzo').textContent = email;
      document.getElementById('confermaEmailBanner').style.display = 'flex';
      document.getElementById('cloudEmail').value = email;
      document.getElementById('cloudPw').focus();
    }
  }catch(e){
    console.error(e);
    err.textContent = traduciErrore(e && e.message); err.style.display='block';
  }
});

document.getElementById('cloudRecuperoBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('cloudEmail').value.trim().toLowerCase();
  if(!emailValida(email)){ mostraErroreAccesso("Scrivi la tua email qui sopra, poi premi di nuovo."); return; }
  const el = document.getElementById('cloudErr');
  try{
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    el.style.color = error ? 'var(--accent)' : 'var(--ok)';
    el.textContent = error ? traduciErrore(error.message) : "Ti ho mandato un'email per reimpostare la password.";
  }catch(e){
    console.error(e);
    el.style.color = 'var(--accent)';
    el.textContent = traduciErrore(e && e.message);
  }
  el.style.display = 'block';
});

document.getElementById('cloudRicontrolla').addEventListener('click', dopoAccessoOnline);

document.getElementById('recoveryBtn').addEventListener('click', async ()=>{
  const pw1 = document.getElementById('recoveryPw1').value;
  const pw2 = document.getElementById('recoveryPw2').value;
  const err = document.getElementById('recoveryErr');
  err.style.display = 'none';
  if(pw1.length < 8){ err.textContent = "La password deve avere almeno 8 caratteri."; err.style.display='block'; return; }
  if(pw1 !== pw2){ err.textContent = "Le due password non coincidono."; err.style.display='block'; return; }
  let aggiornata;
  try{
    aggiornata = await sb.auth.updateUser({ password: pw1 });
  }catch(e){
    // updateUser stessa può lanciare invece di restituire {error} (bug
    // segnalato con screenshot: "null is not an object (evaluating
    // 'vi.url')" — un errore grezzo della libreria che sfuggiva a qualunque
    // try/catch, qui non ce n'era nessuno). In questo caso la password NON
    // è garantita salvata: resto sul modulo e permetto di riprovare, invece
    // di lasciare la persona bloccata su un testo incomprensibile.
    console.error(e);
    err.textContent = traduciErrore(e && e.message); err.style.display='block';
    return;
  }
  if(aggiornata.error){ err.textContent = traduciErrore(aggiornata.error.message); err.style.display='block'; return; }
  // Da qui la password È salvata: è il risultato che conta per la persona,
  // quindi qualunque problema nei passi seguenti (chiudere la sessione di
  // recupero) non deve più far sparire questo esito né lasciarla bloccata.
  _recuperoPasswordAttivo = false;
  try{ await sb.auth.signOut(); }catch(e){ console.error(e); }
  document.getElementById('recoveryPw1').value = '';
  document.getElementById('recoveryPw2').value = '';
  mostraCloudGate('accedi');
  const el = document.getElementById('cloudErr');
  el.style.color = 'var(--ok)';
  el.textContent = "Password aggiornata ✓ ora accedi con la nuova password.";
  el.style.display = 'block';
});
document.getElementById('cloudRiprova').addEventListener('click', ()=>location.reload());
document.getElementById('cloudEsci').addEventListener('click', async ()=>{
  if(_canaleMioProfilo){ sb.removeChannel(_canaleMioProfilo); _canaleMioProfilo = null; }
  await sb.auth.signOut();
  utenteOnline = null; rigaOnline = null;
  mostraCloudGate('accedi');
});


