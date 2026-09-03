'use strict';
// ============================================================
// Carica il vero index.html dentro jsdom, così i test lavorano sul codice
// reale dell'app (non su copie riscritte a mano che con il tempo divergono).
//
// Per farlo senza toccare la rete:
//  - i tre file locali (config.js, brand.js, corpo*.js, esercizi.js) vengono
//    letti da disco e messi inline al posto dei loro <script src="...">
//  - le librerie da CDN (supabase-js, Chart.js, xlsx) vengono sostituite con
//    stub minimi: l'app le usa solo dentro funzioni che i test non chiamano,
//    o dietro a un sb finto che forniamo noi (vedi installFakeSupabase)
//  - APP_CONFIG resta vuoto: l'app si ferma da sola sulla schermata di
//    configurazione mancante (mai una vera chiamata di rete). Da lì loadApp()
//    porta la finestra allo stato di un login online riuscito — vedi FINTO_LOGIN
//    qui sotto — senza mai parlare con Supabase davvero.
// ============================================================
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

const STUB_LIBS = `
window.APP_CONFIG = { url:"", chiave:"" };
window.supabase = { createClient: function(){ return {}; } };
window.Chart = function(){ this.destroy=function(){}; this.update=function(){}; };
window.Chart.register = function(){};
window.XLSX = { utils:{ book_new(){return {};}, aoa_to_sheet(){return {};}, book_append_sheet(){} }, writeFile(){} };
`;

function buildHtml(){
  let html = readFile('index.html');

  // le tre <script src="https://cdn...">: sostituite da stub, in ordine di apparizione
  html = html.replace(/<script src="js\/config\.js"><\/script>/, `<script>${STUB_LIBS}</script>`);
  html = html.replace(/<script src="js\/brand\.js"><\/script>/, `<script>${readFile('js/brand.js')}</script>`);
  // libreria Supabase: servita da js/vendor/supabase.js (non più dal CDN), ma
  // qui resta stubbata come le altre — i test non chiamano mai davvero
  // supabase.createClient(), sostituiscono direttamente `sb` a mano.
  html = html.replace(/<script src="js\/vendor\/supabase\.js"><\/script>/, '');
  html = html.replace(/<script src="https:\/\/cdnjs[^"]*chart[^"]*"><\/script>/i, '');
  html = html.replace(/<script src="https:\/\/cdnjs[^"]*xlsx[^"]*"><\/script>/i, '');
  html = html.replace(/<script src="js\/corpo\.js"><\/script>/, `<script>${readFile('js/corpo.js')}</script>`);
  html = html.replace(/<script src="js\/corpo-donna\.js"><\/script>/, `<script>${readFile('js/corpo-donna.js')}</script>`);
  html = html.replace(/<script src="js\/esercizi\.js"><\/script>/, `<script>${readFile('js/esercizi.js')}</script>`);

  // Logica dell'app (ex unico <script> inline in fondo a index.html, ora divisa
  // in file per argomento sotto js/): stesso trattamento, un file alla volta,
  // nello stesso ordine con cui compaiono in index.html.
  html = html.replace(/<script src="(js\/[a-z-]+\/[a-z-]+\.js|js\/init\.js)"><\/script>/g,
    (match, rel) => `<script>${readFile(rel)}</script>`);
  return html;
}

// Con APP_CONFIG vuoto l'app (giustamente) non riesce ad avviarsi online: si
// ferma sulla schermata "configurazione mancante" (vedi js/init.js). Da qui la
// porto allo stesso stato finale di un vero login online riuscito — un
// profilo in state.profiles, activeProfileId impostato, home mostrata —
// esattamente il punto a cui arriverebbe dopoAccessoOnline() in js/account/account.js
// dopo aver parlato con Supabase, ma senza fare nessuna chiamata di rete.
// Fino al 03/09/2026 questo lo faceva da sola l'app stessa: c'era un ramo
// "profilo locale" che partiva da solo quando Supabase non era configurato
// (comodo per i test, ma mai usato davvero: nella app reale config.js ha
// sempre le credenziali). Tolto quel ramo, il bootstrap dei test è diventato
// esplicito qui invece che implicito nell'app.
const FINTO_LOGIN = `
  const profilo = normalizzaProfilo(profiloVuotoPerCloud());
  profilo.id = 'test-uid';
  profilo.name = 'Io';
  profilo.email = 'test@vigor.local';
  profilo.approvato = true;
  state.profiles = [profilo];
  activeProfileId = profilo.id;
  actingProfileId = null;
  utenteOnline = { id: profilo.id, email: profilo.email };
  rigaOnline = { id: profilo.id, email: profilo.email, nome: profilo.name, approvato: true, dati: profilo };
  window.modalitaOnline = () => true;
  document.documentElement.classList.remove('avvio');
  nascondiCloudGate();
  controllaSaltati(true);
  renderAll();
  mostraHome();
`;

// Crea una nuova finestra jsdom con l'app già avviata e un profilo loggato.
// Ogni test parte da zero: nessuno stato è condiviso fra un test e l'altro.
async function loadApp(){
  const html = buildHtml();
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e)=>{ errors.push(e); });
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    resources: undefined,
    virtualConsole
  });
  const { window } = dom;
  if(errors.length){
    const msg = errors.map(e => (e && e.detail && e.detail.stack) || e.message || String(e)).join('\n---\n');
    throw new Error('Errori durante il caricamento dell\'app in jsdom:\n' + msg);
  }
  // localStorage pulito ad ogni test (jsdom ne fornisce uno reale per finestra)
  // Lascio che l'app giri fino in fondo al proprio avvio sincrono, poi la
  // porto oltre la schermata di login (vedi FINTO_LOGIN sopra).
  // Alcune parti (timer, animazioni) usano setTimeout: non serve aspettarle qui.
  window.eval(`(() => { ${FINTO_LOGIN}\n})()`);
  return { dom, window, document: window.document };
}

// Esegue del codice DENTRO la finestra jsdom (stesso scope globale dello script
// dell'app: vede sb, utenteOnline, _rapporti, e tutte le funzioni globali) e
// restituisce il risultato al test Node. Usa eval indiretto: per questo può
// leggere/scrivere le `let`/`const` di primo livello dell'app.
async function run(window, asyncBody){
  const wrapped = `(async () => { ${asyncBody}\n})()`;
  const result = await window.eval(wrapped);
  // Il valore torna dal realm separato di jsdom (Array/Object propri di
  // quella finestra): lo riporto a strutture native di Node passando per
  // JSON, così `assert.deepEqual`/`deepStrictEqual` in Node non inciampano
  // sul controllo del costruttore cross-realm. Va bene perché nei test ci
  // interessano solo dati semplici (stringhe, numeri, booleani, oggetti/array
  // piatti), mai funzioni o nodi DOM.
  if(result === undefined) return undefined;
  return JSON.parse(JSON.stringify(result));
}

module.exports = { loadApp, run, ROOT };
