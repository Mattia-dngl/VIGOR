// ============================================================
// ALLENAMENTI STIMATI (11/09/2026)
// I giorni previsti dalla scheda e mai registrati oggi diventano un log
// "saltato" con la lista esercizi vuota (autoRegistraSaltati, in
// js/onboarding/recupero-codici.js). Qui c'è il passo successivo, chiesto
// da chi usa l'app: riempire quei giorni con i carichi, invece di lasciare
// un buco, facendo la MEDIA di quello che è stato davvero sollevato.
//
// Due paletti, decisi apposta, perché questi allenamenti NON sono successi:
//
//  1) La media è per ESERCIZIO, tra le sue ultime sedute — mai tra esercizi
//     diversi. La media tra "Alzate Laterali 10 kg" e "Chest Press 60 kg"
//     non vuol dire niente: l'unico confronto sensato è lo stesso esercizio
//     con sé stesso nel tempo.
//  2) Ogni log stimato porta `stimato: true` e da lì in poi è trattato
//     diversamente ovunque conti la differenza tra "l'ho fatto" e "forse
//     l'avrei fatto": niente record personali (recordPersonale, costanti.js),
//     niente "ultima volta" quando registri (ultimaPrestazione,
//     onboarding.js), e nei numeri che vede il PT restano contati a parte
//     (pt-area.js). Nel volume muscolare e nel calendario invece ci sono:
//     è tutto il motivo per cui esistono, riempire i buchi della continuità.
//
// Si sostituiscono SOLO i saltati automatici (`auto: true`). Un "saltato"
// scelto a mano resta com'è: se hai detto tu che quel giorno non ti sei
// allenato, l'app non ha nessun titolo per riscriverlo.
// ============================================================

// Quante sedute vere guardo indietro per fare la media. Tre è il compromesso:
// una sola sarebbe una copia (non una media), troppe riporterebbero a galla
// carichi di mesi fa che non dicono più niente su dove sei adesso.
const SEDUTE_PER_STIMA = 3;

// I kg si arrotondano alla mezza unità (è il salto minimo che esiste davvero
// tra manubri e piastre), i km al decimo, tutto il resto all'intero: una
// media di 9,67 ripetizioni non è un numero che si può fare in palestra.
function arrotondaStima(campo, valore){
  if(campo === 'kg') return Math.round(valore*2)/2;
  if(campo === 'km') return Math.round(valore*10)/10;
  return Math.round(valore);
}

function nomeEsercizioNorm(n){ return (n||'').trim().toLowerCase(); }

// Le sedute VERE in cui compare l'esercizio, dalla più recente, al massimo
// SEDUTE_PER_STIMA. Le stime sono escluse di proposito: se una stima potesse
// entrare nella media della stima successiva, dopo qualche settimana di
// giorni saltati l'app starebbe facendo la media delle proprie invenzioni.
function sedutePerStima(prof, nomeEsercizio, primaDi){
  const nome = nomeEsercizioNorm(nomeEsercizio);
  const raccolte = [];
  const candidati = (prof.logs||[])
    .filter(l => l.status === 'registrato' && !l.stimato && l.date < primaDi)
    .sort((a,b) => b.date.localeCompare(a.date));
  for(const log of candidati){
    const ex = (log.exercises||[]).find(e => nomeEsercizioNorm(e.name) === nome);
    if(!ex) continue;
    const serie = (ex.sets||[]).filter(s => CAMPI_SERIE.some(k => s[k]));
    if(serie.length) raccolte.push(serie);
    if(raccolte.length >= SEDUTE_PER_STIMA) break;
  }
  return raccolte;
}

// Media di un singolo campo (kg, reps, seconds, km, minuti) tra le serie
// corrispondenti. I campi vuoti non fanno media e non valgono zero: a corpo
// libero (trazioni) il kg è "" in tutte le sedute e deve restare "", non
// diventare 0 kg.
function mediaCampoSerie(campioni, campo){
  const valori = campioni
    .map(s => parseFloat(s && s[campo]))
    .filter(v => !isNaN(v) && v > 0);
  if(!valori.length) return '';
  const media = valori.reduce((a,b) => a+b, 0) / valori.length;
  return String(arrotondaStima(campo, media));
}

// Le serie stimate di un esercizio. La forma (quante serie, e le tappe dei
// dropset) la dà la seduta più recente: è quella che dice come lo stai
// facendo adesso. Le sedute più corte prestano la loro ultima serie per gli
// indici che non hanno, invece di sparire dalla media a metà esercizio.
function stimaSerieEsercizio(prof, nomeEsercizio, primaDi){
  const raccolte = sedutePerStima(prof, nomeEsercizio, primaDi);
  if(!raccolte.length) return null;
  const riferimento = raccolte[0];
  const serie = [];
  for(let i=0; i<riferimento.length; i++){
    const campioni = raccolte.map(r => r[Math.min(i, r.length-1)]).filter(Boolean);
    const s = {};
    CAMPI_SERIE.forEach(campo => {
      const v = mediaCampoSerie(campioni, campo);
      if(v) s[campo] = v;
    });
    if(!Object.keys(s).length) continue;
    // stessa forma dei salvataggi veri (vedi registra.js): questi tre campi
    // ci sono sempre, anche vuoti — chi legge le serie li dà per scontati
    s.reps = s.reps || ''; s.kg = s.kg || ''; s.seconds = s.seconds || '';
    if(typeof riferimento[i].tappa === 'number') s.tappa = riferimento[i].tappa;
    serie.push(s);
  }
  return serie.length ? serie : null;
}

// Qual è il giorno di scheda che toccava in quella data. Parto dalla scheda
// del log (non da quella attiva): un giorno saltato ad agosto appartiene alla
// scheda di agosto, anche se nel frattempo ne hai iniziata un'altra.
function giornoSchedaDelLog(prof, log){
  const prog = (prof.programs||[]).find(p => p.id === log.programId);
  if(!prog || !Array.isArray(prog.days)) return null;
  const data = new Date(log.date + 'T12:00:00');
  const day = prog.days.find(d => d.weekday === WEEKDAYS[data.getDay()]);
  return day ? { prog, day } : null;
}

// L'allenamento stimato di un giorno. Gli esercizi senza nessuno storico
// vengono lasciati fuori: inventare un carico dal nulla sarebbe un numero
// senza nessun fondamento. Se NESSUN esercizio del giorno ha uno storico
// torno null e quel giorno resta saltato, com'è giusto.
function stimaAllenamento(prof, prog, day, iso){
  const exercises = [];
  (day.exercises||[]).forEach(ex => {
    const sets = stimaSerieEsercizio(prof, ex.name, iso);
    if(sets) exercises.push({ name: ex.name, sets });
  });
  if(!exercises.length) return null;
  return {
    id: uid(), date: iso, programId: prog.id, status: 'registrato',
    stimato: true, dayKey: day.key, dayName: day.name,
    exercises, notes: ''
  };
}

// ============================================================
// Riempi / rimuovi
// ============================================================

// Trasforma in stime i giorni segnati saltati IN AUTOMATICO. Torna quanti
// ne ha riempiti. Volutamente non specchia niente sulla tabella
// "allenamenti" (js/core/stato.js): lì dentro vanno gli allenamenti veri —
// una stima è un dato derivato, si ricalcola quando serve.
function riempiSaltatiConStima(){
  const prof = activeProfile();
  if(!prof || !Array.isArray(prof.logs)) return 0;
  const daRiempire = prof.logs.filter(l => l.status === 'saltato' && l.auto);
  let fatti = 0;
  daRiempire.forEach(log => {
    const g = giornoSchedaDelLog(prof, log);
    if(!g) return;
    const stima = stimaAllenamento(prof, g.prog, g.day, log.date);
    if(!stima) return;
    prof.logs[prof.logs.indexOf(log)] = stima;
    fatti++;
  });
  if(fatti > 0){
    prof.logs.sort((a,b) => a.date.localeCompare(b.date));
    save();
  }
  return fatti;
}

// Toglie tutte le stime e rimette quei giorni come saltati (è esattamente lo
// stato da cui erano partiti). Torna quante ne ha tolte.
function rimuoviStime(){
  const prof = activeProfile();
  if(!prof || !Array.isArray(prof.logs)) return 0;
  const quante = prof.logs.filter(l => l.stimato).length;
  if(!quante) return 0;
  prof.logs = prof.logs.filter(l => !l.stimato);
  save();
  _autoSkipFatto = null;     // quei giorni tornano "da controllare"
  autoRegistraSaltati();
  return quante;
}

// ============================================================
// Automatico
// Spento salvo scelta esplicita: il contrario del "segna i saltati", che è
// acceso di suo. Segnare un giorno come saltato descrive la realtà; riempirlo
// con dei numeri stimati è una scelta che deve fare la persona, non l'app.
// ============================================================
function autoStimaAttiva(){
  const prof = loggedInProfile();
  return !!(prof && prof.autoStima);
}

let _autoStimaFatto = null;   // una volta al giorno, come per i saltati
function controllaStime(avvisa){
  if(!autoStimaAttiva()) return;
  const prof = activeProfile();
  if(!prof) return;
  const chiave = prof.id + "|" + new Date().toISOString().slice(0,10);
  if(_autoStimaFatto === chiave) return;
  _autoStimaFatto = chiave;
  const n = riempiSaltatiConStima();
  if(n > 0 && avvisa){
    toast(n === 1 ? "1 giorno saltato riempito con una stima"
                  : `${n} giorni saltati riempiti con una stima`);
  }
}
