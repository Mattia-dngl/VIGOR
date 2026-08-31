// FUNZIONAMENTO OFFLINE E AGGIORNAMENTI
// ============================================================
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      // se arriva una versione nuova, lo dico invece di cambiarla sotto i piedi
      function proponiAggiornamento(nuovo){
        const banner = document.getElementById('aggBanner');
        banner.classList.add('show');
        document.getElementById('aggBtn').onclick = ()=>{
          banner.classList.remove('show');
          if(nuovo) nuovo.postMessage('AGGIORNA_SUBITO');
          setTimeout(()=>location.reload(), 300);
        };
      }
      if(reg.waiting) proponiAggiornamento(reg.waiting);
      reg.addEventListener('updatefound', ()=>{
        const nuovo = reg.installing;
        if(!nuovo) return;
        nuovo.addEventListener('statechange', ()=>{
          if(nuovo.state === 'installed' && navigator.serviceWorker.controller){
            proponiAggiornamento(nuovo);
          }
        });
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
