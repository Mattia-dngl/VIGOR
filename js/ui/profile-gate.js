// PROFILE GATE
// ============================================================
let pendingProfileId = null;

function renderProfileGate(){
  document.documentElement.classList.remove('avvio');
  document.body.classList.remove('app-pronta');
  showGateSelectView();
  const list = document.getElementById('profileList');
  list.innerHTML = "";
  if(state.profiles.length===0){
    list.innerHTML = '<div class="empty">Nessun profilo ancora. Creane uno qui sotto.</div>';
  } else {
    state.profiles.forEach(p=>{
      const el = document.createElement('div');
      el.className='profile-chip';
      const amm = (p.email||'').toLowerCase() === EMAIL_AMMINISTRATORE;
      const attesa = !p.approvato;
      el.innerHTML = `<button type="button" class="pname-btn">${escapeAttr(p.name)}${amm?' <span class="badge-amm">admin</span>':''}${attesa?' <span class="badge-attesa">in attesa</span>':''}
          ${p.email?`<span class="pmail">${escapeAttr(p.email)}</span>`:''}</button>
        <button type="button" class="delete-profile">Elimina</button>`;
      el.querySelector('.pname-btn').addEventListener('click', ()=>askPasswordFor(p.id));
      el.querySelector('.delete-profile').addEventListener('click', ()=>{
        customConfirm(`Eliminare il profilo "${p.name}"? Verranno cancellati per sempre scheda, dieta e storico allenamenti di questo profilo.`, ()=>{
          state.profiles = state.profiles.filter(x=>x.id!==p.id);
          save();
          renderProfileGate();
          toast("Profilo eliminato");
        });
      });
      list.appendChild(el);
    });
  }
}

function showGateSelectView(){
  document.getElementById('gateSelectView').style.display='block';
  document.getElementById('gatePasswordView').style.display='none';
  document.getElementById('gateCodiceView').style.display='none';
}
function askPasswordFor(id){
  const prof = state.profiles.find(p=>p.id===id);
  pendingProfileId = id;
  document.getElementById('gateSelectView').style.display='none';
  document.getElementById('gatePasswordView').style.display='block';
  document.getElementById('pwProfileName').textContent = prof.name;
  document.getElementById('enterProfilePw').value = "";
  document.getElementById('pwError').style.display='none';
  document.getElementById('recuperoBox').style.display='none';
  document.getElementById('pwDimenticataBtn').textContent = "Password dimenticata?";
  document.getElementById('enterProfilePw').focus();
}
document.getElementById('backToListBtn').addEventListener('click', ()=>{ pendingProfileId=null; showGateSelectView(); });

function trySubmitPassword(){
  const prof = state.profiles.find(p=>p.id===pendingProfileId);
  if(!prof) return;
  const pw = document.getElementById('enterProfilePw').value;
  const err = document.getElementById('pwError');
  if(simpleHash(pw) !== prof.passwordHash){
    err.textContent = "Password errata, riprova.";
    err.style.display='block';
    return;
  }
  if(prof.bloccato){
    mostraAccountBloccatoOverlay({ testoAzione:'Torna alla lista profili', suAzione: ()=>{
      pendingProfileId = null;
      showGateSelectView();
    }});
    return;
  }
  if(!prof.approvato){
    err.textContent = "Account non ancora approvato da chi gestisce l'app. Riprova più tardi.";
    err.style.display='block';
    return;
  }
  enterProfile(prof.id);
}
document.getElementById('submitPwBtn').addEventListener('click', trySubmitPassword);
document.getElementById('enterProfilePw').addEventListener('keydown', e=>{ if(e.key==='Enter') trySubmitPassword(); });

function enterProfile(id){
  document.documentElement.classList.remove('avvio');
  activeProfileId = id;
  actingProfileId = null;
  pendingProfileId = null;
  _autoSkipFatto = null;
  document.getElementById('profileGate').style.display='none';
  controllaSaltati(true);
  renderAll();
  chiediProtezioneDati().then(()=>aggiornaStatoDati());
  _timerDurata = impostazioniTimer().durata;
  renderScorciatoieTimer();
  _bozzaPronta = false;
  if(ripristinaBozza()) toast("Ripresa la registrazione lasciata a metà");
  _bozzaPronta = true;
  mostraHome();
}
document.getElementById('createProfileBtn').addEventListener('click', ()=>{
  const nameInput = document.getElementById('newProfileName');
  const emailInput = document.getElementById('newProfileEmail');
  const pwInput = document.getElementById('newProfilePw');
  const pw2Input = document.getElementById('newProfilePw2');
  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const pw = pwInput.value;
  const pw2 = pw2Input.value;
  if(!name){ toast("Inserisci un nome."); return; }
  if(!emailValida(email)){ toast("Inserisci un'email valida."); return; }
  if(state.profiles.some(p=>(p.email||'').toLowerCase()===email)){ toast("Esiste già un profilo con questa email."); return; }
  if(state.profiles.some(p=>p.name.toLowerCase()===name.toLowerCase())){ toast("Esiste già un profilo con questo nome."); return; }
  if(pw.length < 4){ toast("La password deve avere almeno 4 caratteri."); return; }
  if(pw !== pw2){ toast("Le due password non coincidono."); return; }
  // L'amministratore entra sempre. Anche il primo account in assoluto, altrimenti
  // non ci sarebbe nessuno a poter approvare gli altri.
  const subito = (email === EMAIL_AMMINISTRATORE) || state.profiles.length === 0;
  const prof = newProfile(name, email, pw, subito);
  const codice = generaCodice();
  prof.recuperoHash = simpleHash(normalizzaCodice(codice));
  state.profiles.push(prof);
  save();
  nameInput.value = ""; emailInput.value = ""; pwInput.value = ""; pw2Input.value = "";
  mostraCodiceRecupero(codice, prof.id, subito);
});
document.querySelectorAll('#setSesso .seg-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const lp = loggedInProfile();
    if(!lp) return;
    document.querySelectorAll('#setSesso .seg-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const eraSesso = lp.sesso;
    lp.sesso = btn.dataset.val;
    if(eraSesso !== lp.sesso) ricostruisciFiguraCorpo();
    save();
    if(typeof modalitaOnline === 'function' && modalitaOnline()) inviaOnline();
    toast(`Sesso impostato: ${btn.dataset.val === 'donna' ? 'Donna' : 'Uomo'}`);
  });
});

document.getElementById('setAltezza').addEventListener('change', function(){
  const lp = loggedInProfile();
  if(!lp) return;
  const v = parseFloat(this.value);
  lp.altezza = (v && v>0) ? v : null;
  save();
  if(typeof modalitaOnline === 'function' && modalitaOnline()) inviaOnline();
});
// L'età non si scrive più a mano: si imposta solo la data di nascita e l'età si
// ricava da calcolaEta(). Così resta sempre corretta senza doverla aggiornare
// manualmente ogni compleanno.
document.getElementById('setDataNascita').addEventListener('change', function(){
  const lp = loggedInProfile();
  if(!lp) return;
  lp.dataNascita = this.value || null;
  save();
  if(typeof modalitaOnline === 'function' && modalitaOnline()) inviaOnline();
  renderEtaCalcolata();
});
function renderEtaCalcolata(){
  const lp = loggedInProfile();
  const el = document.getElementById('setEtaCalcolata');
  const nota = document.getElementById('setEtaLegacyNota');
  if(!el || !lp) return;
  const eta = etaProfilo(lp);
  el.textContent = eta ? `${eta} anni` : '—';
  nota.textContent = (!lp.dataNascita && lp.eta) ? '(valore inserito in passato — imposta la data di nascita per calcolarla da sola)' : '';
}
document.getElementById('setLivelloAttivita').addEventListener('change', function(){
  const lp = loggedInProfile();
  if(!lp) return;
  lp.livelloAttivita = this.value;
  save();
  if(typeof modalitaOnline === 'function' && modalitaOnline()) inviaOnline();
});

document.getElementById('autoSkipToggle').addEventListener('change', (e)=>{
  const prof = loggedInProfile();
  if(!prof) return;
  prof.autoSkip = e.target.checked;
  save();
  if(e.target.checked){
    _autoSkipFatto = null;
    const n = autoRegistraSaltati();
    toast(n>0 ? `Attivato — ${n} giorni segnati come saltati` : "Attivato");
    renderHeader(); renderHistory(); renderVolume();
  } else {
    toast("Disattivato — i giorni saltati non verranno più segnati da soli");
  }
});

document.getElementById('saveAccountNameBtn').addEventListener('click', ()=>{
  const newName = document.getElementById('accountNameInput').value.trim();
  if(!newName){ toast("Inserisci un nome."); return; }
  const prof = loggedInProfile();
  if(state.profiles.some(p=>p.id!==prof.id && p.name.toLowerCase()===newName.toLowerCase())){
    toast("Esiste già un altro profilo con questo nome."); return;
  }
  prof.name = newName;
  save();
  renderHeader();
  toast("Nome aggiornato ✓");
});

document.getElementById('saveAccountPwBtn').addEventListener('click', ()=>{
  const prof = loggedInProfile();
  const oldPw = document.getElementById('accountOldPw').value;
  const newPw = document.getElementById('accountNewPw').value;
  const newPw2 = document.getElementById('accountNewPw2').value;
  if(simpleHash(oldPw) !== prof.passwordHash){ toast("Password attuale errata."); return; }
  if(newPw.length < 4){ toast("La nuova password deve avere almeno 4 caratteri."); return; }
  if(newPw !== newPw2){ toast("Le due password non coincidono."); return; }
  prof.passwordHash = simpleHash(newPw);
  save();
  document.getElementById('accountOldPw').value = "";
  document.getElementById('accountNewPw').value = "";
  document.getElementById('accountNewPw2').value = "";
  toast("Password aggiornata ✓");
});

// ============================================================
