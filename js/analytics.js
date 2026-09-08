'use strict';
// ============================================================
// ANALYTICS COOKIELESS (Task 6b roadmap) — Plausible o Umami, a scelta.
// DISATTIVATO finché non imposti ANALYTICS_CONFIG qui sotto: senza un
// provider scelto non si carica nessuno script esterno e non parte
// nessuna richiesta di rete — esattamente come config.js per Supabase.
//
// Come attivarlo:
//  - Plausible: crea il sito su plausible.io, metti qui il dominio
//    registrato in dominioPlausible, provider:'plausible'.
//  - Umami: metti qui l'URL del tuo script e il website id (li trovi
//    nella dashboard Umami, sezione Websites -> Tracking code), provider:'umami'.
//
// Zero dati personali negli eventi: eventoAnalytics() manda solo il nome
// dell'evento (e, se serve, proprietà GENERICHE tipo il piano scelto) —
// mai email, nome, id utente o altro che identifichi una persona.
// ============================================================
window.ANALYTICS_CONFIG = {
  provider: null,          // 'plausible' | 'umami' | null (null = disattivato)
  dominioPlausible: '',    // es. "vigor-app.it"
  scriptUmami: '',         // es. "https://umami.tuodominio.it/script.js"
  websiteIdUmami: ''
};

(function caricaScriptAnalytics(){
  const cfg = window.ANALYTICS_CONFIG;
  if(!cfg || !cfg.provider) return;
  const s = document.createElement('script');
  s.defer = true;
  if(cfg.provider === 'plausible' && cfg.dominioPlausible){
    s.dataset.domain = cfg.dominioPlausible;
    s.src = 'https://plausible.io/js/script.js';
  } else if(cfg.provider === 'umami' && cfg.scriptUmami && cfg.websiteIdUmami){
    s.dataset.websiteId = cfg.websiteIdUmami;
    s.src = cfg.scriptUmami;
  } else {
    return; // provider scelto ma configurazione incompleta: resta disattivato
  }
  document.head.appendChild(s);
})();

// nome: stringa breve tipo "registrazione", "primo_allenamento". props
// (opzionale): oggetto piatto di valori GENERICI, mai identificativi.
function eventoAnalytics(nome, props){
  try{
    const cfg = window.ANALYTICS_CONFIG;
    if(!cfg || !cfg.provider) return;
    if(cfg.provider === 'plausible' && typeof window.plausible === 'function'){
      window.plausible(nome, props ? { props } : undefined);
    } else if(cfg.provider === 'umami' && window.umami && typeof window.umami.track === 'function'){
      window.umami.track(nome, props);
    }
  }catch(e){ console.error(e); }
}

// ============================================================
// RITORNO 7/30 GIORNI — confronta l'ultima visita salvata in locale (mai
// mandata al server: resta sul telefono) con oggi. Va chiamata una volta
// per avvio app, quando si sa già chi è (dopo login/ripristino locale).
// ============================================================
const ANALYTICS_ULTIMA_VISITA_KEY = 'vigorAnalyticsUltimaVisita';
function segnaEVerificaRitorno(){
  try{
    const oggi = new Date();
    const precedente = localStorage.getItem(ANALYTICS_ULTIMA_VISITA_KEY);
    if(precedente){
      const giorni = Math.floor((oggi - new Date(precedente)) / 86400000);
      if(giorni >= 30) eventoAnalytics('ritorno_30gg');
      else if(giorni >= 7) eventoAnalytics('ritorno_7gg');
    }
    localStorage.setItem(ANALYTICS_ULTIMA_VISITA_KEY, oggi.toISOString());
  }catch(e){ console.error(e); }
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { eventoAnalytics, segnaEVerificaRitorno };
}
