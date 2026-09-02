// ============================================================
// CHECK-IN PERIODICO — lato cliente: compilazione (peso/foto/sensazione/nota).
// La cadenza e l'attivazione le decide il PT per singolo rapporto
// (attivo.checkin_attivo/checkin_cadenza_settimane, rapporti_pt) — qui si
// gestisce solo l'invio, mai chi/quando lo chiede. Il check-in resta sempre
// una proposta: si può compilare anche fuori dal promemoria.
// ============================================================
let _checkinFotoDataUrl = null;

function apriCheckinCompilazione(){
  const prof = loggedInProfile();
  const ultimoPeso = prof ? ultimoPesoRegistrato(prof) : null;
  document.getElementById('checkinPeso').value = ultimoPeso ? ultimoPeso.weight : '';
  document.getElementById('checkinFotoAnteprima').style.display = 'none';
  // niente src="" qui: un <img src=""> viene interpretato dal browser come
  // "carica l'URL della pagina corrente", che fallisce a decodificarsi come
  // immagine e scatena il listener globale di errore risorsa in index.html
  // (mostrava "Risorsa non caricata: <img> .../index.html" a tutta pagina
  // ogni volta che si apriva il check-in). removeAttribute evita il problema.
  document.getElementById('checkinFotoAnteprima').querySelector('img').removeAttribute('src');
  _checkinFotoDataUrl = null;
  document.querySelectorAll('#checkinSensazioneToggle .seg-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('checkinNota').value = '';
  document.getElementById('checkinCompilaOverlay').classList.add('show');
}
function chiudiCheckinCompilazione(){
  document.getElementById('checkinCompilaOverlay').classList.remove('show');
}
document.getElementById('checkinCompilaChiudi').addEventListener('click', chiudiCheckinCompilazione);
document.getElementById('checkinCompilaOverlay').addEventListener('click', e=>{
  if(e.target.id === 'checkinCompilaOverlay') chiudiCheckinCompilazione();
});

document.querySelectorAll('#checkinSensazioneToggle .seg-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('#checkinSensazioneToggle .seg-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Stessa idea di ridimensionamento/compressione già usata per la foto
// profilo (js/account/account.js, acctAvatarFile), ma qui il lato è molto
// più grande (960 invece di 240): una foto profilo resta sempre piccola
// (avatar), una foto di progresso invece si vede anche a piena larghezza
// nell'anteprima e a schermo intero dal PT — 480px ci arrivava sfocata
// (il browser la doveva allargare). 960px + qualità .85 + smoothing "high"
// in fase di ridimensionamento restano nitidi anche lì, a fronte di un
// file un po' più pesante (accettabile: un check-in a settimana, non foto
// a raffica).
document.getElementById('checkinFotoBtn').addEventListener('click', ()=>document.getElementById('checkinFotoFile').click());
document.getElementById('checkinFotoFile').addEventListener('change', function(e){
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if(!file) return;
  if(!file.type || !file.type.startsWith('image/')){ toast("Scegli un file immagine."); return; }
  const reader = new FileReader();
  reader.onload = function(ev){
    const img = new Image();
    img.onload = function(){
      const lato = 960;
      const scala = Math.min(1, lato / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scala);
      canvas.height = Math.round(img.height * scala);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      _checkinFotoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const anteprima = document.getElementById('checkinFotoAnteprima');
      anteprima.querySelector('img').src = _checkinFotoDataUrl;
      anteprima.style.display = 'flex';
    };
    img.onerror = function(){ toast("Non riesco a leggere questa immagine."); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});
document.getElementById('checkinFotoRimuovi').addEventListener('click', ()=>{
  _checkinFotoDataUrl = null;
  const anteprima = document.getElementById('checkinFotoAnteprima');
  anteprima.querySelector('img').removeAttribute('src');
  anteprima.style.display = 'none';
});

document.getElementById('checkinInviaBtn').addEventListener('click', ()=>{
  const prof = loggedInProfile();
  if(!prof) return;
  const pesoRaw = document.getElementById('checkinPeso').value;
  const peso = pesoRaw === '' ? null : parseFloat(pesoRaw);
  const sensBtn = document.querySelector('#checkinSensazioneToggle .seg-btn.active');
  const sensazione = sensBtn ? parseInt(sensBtn.dataset.val) : null;
  const nota = document.getElementById('checkinNota').value.trim();
  if(peso == null && !_checkinFotoDataUrl && sensazione == null && !nota){
    toast("Compila almeno un campo prima di inviare.");
    return;
  }
  if(!prof.checkins) prof.checkins = [];
  prof.checkins.push({
    id: uid(), data: new Date().toISOString().slice(0,10), creatoIl: new Date().toISOString(),
    peso, fotoUrl: _checkinFotoDataUrl, sensazione, nota
  });
  save();
  if(typeof modalitaOnline === 'function' && modalitaOnline()) inviaOnline();
  chiudiCheckinCompilazione();
  toast("Check-in inviato ✓");
  if(typeof renderMioPT === 'function') renderMioPT();
});
