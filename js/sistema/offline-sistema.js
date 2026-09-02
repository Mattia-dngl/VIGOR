// FUNZIONAMENTO OFFLINE E AGGIORNAMENTI
// ============================================================
// Aggiornamento sempre automatico, mai in mano alla persona: prima c'era un
// banner "È disponibile una versione aggiornata" con un tasto da toccare, ma
// una correzione pubblicata restava così invisibile finché qualcuno non se
// ne accorgeva e cliccava — capitato davvero il 01-02/09/2026, con più
// correzioni di fila che non arrivavano su un telefono di test proprio per
// questo. sw.js chiama già da solo skipWaiting()/clients.claim() appena una
// versione nuova è pronta: qui basta ricaricare in automatico non appena
// prende il controllo (evento "controllerchange"), una sola volta, per far
// sì che ogni aggiornamento pubblicato arrivi davvero su ogni dispositivo.
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      let ricaricoGiaFatto = false;
      navigator.serviceWorker.addEventListener('controllerchange', ()=>{
        if(ricaricoGiaFatto) return;
        ricaricoGiaFatto = true;
        location.reload();
      });
      // controllo se c'è una versione nuova a ogni riapertura
      document.addEventListener('visibilitychange', ()=>{
        if(document.visibilityState === 'visible') reg.update().catch(()=>{});
      });
    }).catch(err=>console.warn('offline non attivo:', err));
  });
}

// ============================================================
// dimensione leggibile (usata per lo spazio occupato in Impostazioni)
// ============================================================
function pesoLeggibile(byte){
  if(byte < 1024*1024) return Math.round(byte/1024) + " KB";
  return (byte/(1024*1024)).toFixed(1).replace('.', ',') + " MB";
}

// ============================================================
// POPUP VIDEO — si guarda senza uscire dall'app.
// Alcuni siti vietano di essere mostrati dentro altre pagine: in quel caso
// il riquadro resta vuoto e si usa il pulsante per aprirlo a fianco.
