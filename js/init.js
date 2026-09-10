// INIT
// ============================================================
function renderAll(){
  logDateInput.value = new Date().toISOString().slice(0,10);
  controllaOnboarding();
  updateTabVisibility();
  renderHeader();
  renderDayChoices();
  renderHistory();
  renderVolume();
  renderMeasurements();
  renderMealDiary();
  renderProgramView();
  renderNewProgramForm();
}
save();
attachAutocomplete(document.getElementById('mealFoodInput'), foodSourceNames);

function viaSchermoAvvio(){
  const s = document.getElementById('avvioSchermo');
  if(s) s.remove();
}

// VIGOR gira sempre online, su Supabase: non esiste più un ramo "solo su
// questo telefono" (rimosso il 03/09/2026 — era vivo solo quando js/config.js
// non aveva le credenziali, cosa che qui non succede mai).
mostraCloudGate('caricamento');
viaSchermoAvvio();
if(!configurataOnline()){
  document.getElementById('cloudCaricaTxt').innerHTML =
    "Non riesco a leggere la configurazione del server.<br>Controlla js/config.js e riprova.";
  document.getElementById('cloudRiprova').style.display = 'block';
} else {
  attendiLibreria().then(pronta=>{
    if(pronta) return avvioOnline();
    document.getElementById('cloudCaricaTxt').innerHTML =
      "Non riesco a raggiungere il servizio di accesso.<br>Controlla la connessione e riapri l'app.";
    document.getElementById('cloudRiprova').style.display = 'block';
  }).catch(e=>{
    // Rete di sicurezza dell'ULTIMO livello: avvioOnline() ha già i suoi
    // timeout interni (getSession, lettura profilo), ma un errore imprevisto
    // in un punto qualunque della catena — anche uno non coperto da quei
    // timeout — arriverebbe fin qui senza che nessuno lo intercetti, e senza
    // questo .catch() la persona resterebbe bloccata in silenzio sulla
    // schermata "Connessione…" mostrata all'avvio, per sempre, senza nessun
    // errore visibile con cui capire cosa sia successo o riprovare.
    console.error(e);
    document.getElementById('cloudCaricaTxt').innerHTML =
      "Si è verificato un errore imprevisto: " + ((e && e.message) || String(e)) + "<br>Riprova.";
    document.getElementById('cloudRiprova').style.display = 'block';
  });
}
