// FUNZIONAMENTO OFFLINE E AGGIORNAMENTI
// ============================================================
// sw.js chiama già da solo skipWaiting()/clients.claim() appena una
// versione nuova è pronta: qui basta registrarlo. Niente ricaricamento
// forzato quando cambia versione (provato e tolto il 02/09/2026: durante
// una serie ravvicinata di correzioni pubblicate, ogni riapertura innescava
// un ricaricamento automatico — fastidioso mentre si sta usando l'app). La
// versione nuova prende comunque il controllo da sola in background; verrà
// usata dal prossimo avvio naturale dell'app.
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(err=>console.warn('offline non attivo:', err));
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
