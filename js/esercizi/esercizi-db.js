// ============================================================
// GIF ESERCIZI — ExerciseDB (bozza, opzionale)
// ============================================================
// Se in js/config.js il campo "exerciseDbApiKey" resta vuoto, questo file
// non fa nulla: nessuna chiamata di rete, l'app si comporta come prima.
// Mettendo una chiave (da exercisedb.dev, piano di produzione — il piano
// gratuito è solo per esplorare l'API, non va usato qui), il popup video
// prova a mostrare anche la GIF dimostrativa dell'esercizio.
//
// ATTENZIONE: il percorso dell'endpoint e il nome dell'header sotto sono
// presi dalla documentazione pubblica del progetto, non da una chiamata
// verificata (da qui non è raggiungibile exercisedb.dev). Prima di fare
// affidamento su questo file, controlla i due valori qui sotto con una
// vera risposta dell'API.
const EDB_BASE = "https://v2.exercisedb.dev/api/v2";
const EDB_CACHE_PREFIX = "edb_gif_";
const EDB_CACHE_GIORNI = 30; // dopo quanto riprovare a interrogare l'API

function edbApiKey(){
  return (window.APP_CONFIG && window.APP_CONFIG.exerciseDbApiKey || "").trim();
}

function edbLeggiCache(nome){
  try{
    const raw = localStorage.getItem(EDB_CACHE_PREFIX + nome.toLowerCase());
    if(!raw) return undefined; // mai cercato
    const { url, quando } = JSON.parse(raw);
    const giorniPassati = (Date.now() - quando) / 86400000;
    if(giorniPassati > EDB_CACHE_GIORNI) return undefined; // cache scaduta
    return url; // può essere una stringa o null (cercato, non trovato)
  }catch(e){ return undefined; }
}

function edbScriviCache(nome, url){
  try{
    localStorage.setItem(EDB_CACHE_PREFIX + nome.toLowerCase(), JSON.stringify({ url, quando: Date.now() }));
  }catch(e){} // storage pieno o non disponibile: pazienza, si riprova alla prossima apertura
}

// Ritorna l'url della gif per un esercizio, o null se non c'è (nessuna
// chiave configurata, l'API non ce l'ha, o siamo offline). Usa una cache
// locale così ogni esercizio viene interrogato al massimo una volta ogni
// EDB_CACHE_GIORNI, coerente con il resto dell'app che funziona offline.
async function getGifEsercizio(nome){
  if(!edbApiKey() || !nome) return null;

  const cache = edbLeggiCache(nome);
  if(cache !== undefined) return cache;

  try{
    const res = await fetch(EDB_BASE + "/exercises/search?q=" + encodeURIComponent(nome), {
      headers: { "x-api-key": edbApiKey() }
    });
    if(!res.ok){ edbScriviCache(nome, null); return null; }
    const body = await res.json();
    const primo = (body && body.data && body.data[0]) || null;
    const url = primo ? (primo.gifUrl || primo.imageUrl || null) : null;
    edbScriviCache(nome, url);
    return url;
  }catch(e){
    // offline o rete assente: non salvo in cache, così si riprova appena torna la rete
    return null;
  }
}
