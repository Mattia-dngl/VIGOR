'use strict';
// ============================================================
// Manda i visitatori nuovi sulla landing page (landing.html), TENENDO
// l'app qui su index.html: è questo il file che l'icona già installata sul
// telefono apre (start_url in manifest.webmanifest) e non va spostato,
// altrimenti si rompe l'installazione di chi ha già VIGOR sulla schermata
// Home. Deve essere il primo script del <head> (anche prima della rete di
// sicurezza globale) per non far lampeggiare l'app un istante prima del
// redirect.
// ============================================================

// Pura e testabile: decide SE reindirizzare, senza toccare mai
// location/localStorage veri (li riceve già letti da chi la chiama).
function decidiRedirectLanding(input){
  input = input || {};
  if(input.standalone) return false;

  const hash = input.hash || '';
  const search = input.search || '';
  const linkDiAutenticazione = hash.indexOf('access_token') !== -1
    || hash.indexOf('type=recovery') !== -1
    || search.indexOf('code=') !== -1;
  if(linkDiAutenticazione) return false;

  if(new URLSearchParams(search).get('app') === '1') return false;

  const chiavi = input.chiaviLocalStorage || [];
  // gymTrackerPersonaleState_v1: profilo/allenamenti già salvati in locale.
  // sb-*-auth-token: sessione Supabase persistita da supabase-js. In
  // entrambi i casi non è un cliente nuovo: niente landing, dritto in app.
  const haGiaDatiLocali = chiavi.some(k => k === 'gymTrackerPersonaleState_v1'
    || (k.indexOf('sb-') === 0 && k.indexOf('-auth-token') !== -1));
  if(haGiaDatiLocali) return false;

  return true;
}

// Legge i segnali veri dal browser e, se serve, naviga via.
// Nei test (jsdom) si ferma subito: jsdom non sa navigare a un altro
// documento e romperebbe l'intera suite (vedi test/helpers/loadApp.js).
function eseguiRedirectLandingSeNecessario(){
  try{
    if(navigator.userAgent.indexOf('jsdom') !== -1) return;
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
    const chiaviLocalStorage = [];
    try{
      for(let i = 0; i < localStorage.length; i++) chiaviLocalStorage.push(localStorage.key(i));
    }catch(e){}
    if(decidiRedirectLanding({ standalone, hash: location.hash, search: location.search, chiaviLocalStorage })){
      location.replace('landing.html');
    }
  }catch(e){}
}

eseguiRedirectLandingSeNecessario();

if(typeof window !== 'undefined'){
  window.decidiRedirectLanding = decidiRedirectLanding;
}
if(typeof module !== 'undefined' && module.exports){
  module.exports = { decidiRedirectLanding };
}
