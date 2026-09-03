// CAMPI ACCOUNT
// ============================================================
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

// ============================================================
