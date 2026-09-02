// FUNZIONAMENTO OFFLINE E AGGIORNAMENTI
// ============================================================
// sw.js chiama già da solo skipWaiting()/clients.claim() appena una versione
// nuova è pronta. Qui, oltre a registrarlo:
// - { updateViaCache: 'none' } dice al browser di non usare MAI una copia in
//   cache (sua o del sito) di sw.js quando controlla se è cambiato — senza
//   questo, capitava che il controllo confrontasse contro una copia vecchia
//   di sw.js e non trovasse mai differenze;
// - reg.update() a ogni ripresa dell'app forza subito il controllo, invece
//   di aspettare quello automatico del browser (al massimo ogni 24 ore) —
//   utile perché riaprire un'app da Home spesso non è una navigazione vera
//   e propria e quel controllo automatico non scatta da solo.
// Niente ricaricamento mentre l'app è aperta e in uso (provato e tolto il
// 02/09/2026: con più correzioni pubblicate di fila, ogni riapertura
// innescava un ricaricamento continuo e fastidioso). Se però una versione
// nuova prende il controllo mentre l'app è in primo piano, il ricaricamento
// resta "in sospeso" e scatta solo quando la si mette in background (schermo
// spento/app in secondo piano) — invisibile, perché in quel momento nessuno
// la sta guardando — così al rientro è già aggiornata.
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg=>{
      let aggiornamentoInSospeso = false;
      navigator.serviceWorker.addEventListener('controllerchange', ()=>{
        if(document.visibilityState === 'hidden') location.reload();
        else aggiornamentoInSospeso = true;
      });
      document.addEventListener('visibilitychange', ()=>{
        if(document.visibilityState === 'hidden'){
          if(aggiornamentoInSospeso) location.reload();
        } else {
          reg.update().catch(()=>{});
        }
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
