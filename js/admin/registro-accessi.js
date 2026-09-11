// ============================================================
// REGISTRO ACCESSI (11/09/2026) — console del proprietario, punto 02.
//
// Perché una tabella nuova e non i dati di Supabase: auth.audit_log_entries
// è vuota (Supabase non la conserva) e auth.users.last_sign_in_at tiene solo
// l'ULTIMO ingresso, non una storia — e comunque il frontend con la chiave
// anon non può nemmeno leggere lo schema auth. Conseguenza da tenere a
// mente: lo storico parte da zero da adesso, niente è recuperabile
// all'indietro. Ogni giorno senza questo pezzo era storico perso.
//
// Due scritture, molto diverse fra loro:
//  - ingresso RIUSCITO: lo scrive il client, direttamente sulla tabella. La
//    policy gli concede solo righe a nome proprio e solo con esito
//    'riuscito', quindi è al sicuro anche se qualcuno gioca con la console
//    del browser.
//  - tentativo FALLITO: NON può scriverlo il client, perché chi sbaglia la
//    password non è autenticato. Passa dalla edge function
//    "registra-accesso-fallito", che scrive col service role, mette un
//    freno per IP e non rivela mai se quell'email esista.
//
// Nessuna delle due deve poter disturbare l'accesso: qualunque problema
// (rete, permessi, funzione spenta) si ferma qui dentro e la persona entra
// lo stesso. Un registro è un lusso, entrare no.
// ============================================================

// Da dove è arrivato l'ingresso, per quel poco che serve saperlo.
function metodoAccesso(){
  try{
    const u = (typeof utenteOnline !== 'undefined' && utenteOnline) || null;
    const provider = u && u.app_metadata && u.app_metadata.provider;
    return provider === 'google' ? 'google' : 'password';
  }catch(e){ return 'password'; }
}

// Una riga per sessione, non una per ogni ricaricamento di pagina: senza
// questo, aprire e chiudere l'app dieci volte in un'ora sembrerebbero dieci
// ingressi diversi e il registro direbbe una cosa falsa.
const ACCESSO_SEGNATO_KEY = 'vigorAccessoSegnato';

function accessoGiaSegnato(){
  try{
    const precedente = sessionStorage.getItem(ACCESSO_SEGNATO_KEY);
    if(precedente) return true;
    sessionStorage.setItem(ACCESSO_SEGNATO_KEY, new Date().toISOString());
    return false;
  }catch(e){
    // sessionStorage può mancare (finestra privata, storage bloccato): in
    // quel caso meglio una riga in più che nessuna
    return false;
  }
}

async function registraAccessoRiuscito(){
  try{
    if(typeof sb === 'undefined' || !sb) return;
    if(typeof utenteOnline === 'undefined' || !utenteOnline) return;
    if(accessoGiaSegnato()) return;
    await sb.from('accessi').insert({
      profilo_id: utenteOnline.id,
      esito: 'riuscito',
      metodo: metodoAccesso(),
      user_agent: (navigator.userAgent || '').slice(0, 400)
      // niente email: il profilo la contiene già, e non serve duplicarla
      // niente ip_hash: lo calcola solo la edge function, il client non lo sa
    });
  }catch(e){ console.error('registraAccessoRiuscito', e); }
}

async function registraAccessoFallito(email, metodo){
  try{
    if(typeof sb === 'undefined' || !sb) return;
    if(!email) return;
    await sb.functions.invoke('registra-accesso-fallito', {
      body: { email: String(email).trim().toLowerCase(), metodo: metodo || 'password' }
    });
  }catch(e){ console.error('registraAccessoFallito', e); }
}
