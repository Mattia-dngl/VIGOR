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
// Se l'app ha già lavorato online, non deve MAI ricadere nella modalità locale:
// mostrerebbe profili e dati di un altro sistema, confondendo tutto.
const GIA_ONLINE = localStorage.getItem('fitproOnline') === '1';

function viaSchermoAvvio(){
  const s = document.getElementById('avvioSchermo');
  if(s) s.remove();
}

if(configurataOnline() || GIA_ONLINE){
  if(configurataOnline()) localStorage.setItem('fitproOnline','1');
  mostraCloudGate('caricamento');
  viaSchermoAvvio();
  if(!configurataOnline()){
    document.getElementById('cloudCaricaTxt').innerHTML =
      "Non riesco a leggere la configurazione del server.<br>Controlla la connessione e riprova: i tuoi dati sono al sicuro online.";
    document.getElementById('cloudRiprova').style.display = 'block';
  } else {
  attendiLibreria().then(pronta=>{
    if(pronta) return avvioOnline();
    document.getElementById('cloudCaricaTxt').innerHTML =
      "Non riesco a raggiungere il servizio di accesso.<br>Controlla la connessione e riapri l'app.";
    document.getElementById('cloudRiprova').style.display = 'block';
  });
  }
} else {
  preparaBloccoIniziale();
  document.getElementById('profileGate').style.display = 'flex';
  mostraBlocco();
  viaSchermoAvvio();
}
