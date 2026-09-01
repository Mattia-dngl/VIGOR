// GESTIONE DELL'APP — solo per l'account amministratore
// ============================================================

// ---------- gestione utenti dal server (solo amministratore) ----------
async function renderAmministrazioneOnline(){
  const card = document.getElementById('cardAmministrazione');
  const amministratore = sonoAmministratore();
  if(card) card.style.display = amministratore ? 'block' : 'none';
  if(!amministratore || !sb) return;

  // online l'ingresso è protetto dall'account: la vecchia password d'invito non serve.
  // Sotto-sezione intera nascosta per id (prima si cercava per TESTO dentro le
  // label: bastava rinominare un'etichetta per rompere silenziosamente questo nascondimento).
  const subPw = document.getElementById('subPwIngresso');
  if(subPw) subPw.style.display = 'none';
  const subPT = document.getElementById('subPT');
  if(subPT) subPT.style.display = '';

  const { data, error } = await sb.from('profili').select('*').order('creato_il', { ascending: true });
  window._profiliAdmin = data;
  if(error){
    document.getElementById('elencoAttesa').innerHTML =
      '<div class="empty">Non riesco a leggere gli account: ' + error.message + '</div>';
    return;
  }

  const attesa = data.filter(p=>!p.approvato);
  const attivi = data.filter(p=>p.approvato);
  document.getElementById('contaAttesa').textContent = attesa.length ? `(${attesa.length})` : '';
  document.getElementById('contaProfili').textContent = attivi.length ? `(${attivi.length})` : '';
  const subRichieste = document.getElementById('subRichieste');
  if(subRichieste && !subRichieste.dataset.toccato){ subRichieste.open = attesa.length > 0; }

  const conteggio = p => {
    const l = (p.dati && p.dati.logs) || [];
    return l.filter(x=>x.status === 'registrato').length;
  };

  const boxAttesa = document.getElementById('elencoAttesa');
  boxAttesa.innerHTML = attesa.length === 0
    ? '<div class="empty" style="padding:14px 0;">Nessuna richiesta in sospeso.</div>'
    : attesa.map(p=>`<div class="riga-profilo attesa">
        <div class="info"><div class="nome">${p.nome || '(senza nome)'}</div>
          <div class="mail">${p.email}</div></div>
        <div class="azioni">
          <button class="approva" data-appr="${p.id}">Approva</button>
          <button class="pericolo" data-rifiuta="${p.id}">Rifiuta</button>
        </div></div>`).join('');

  const wrap = document.getElementById('elencoProfiliAmm');
  wrap.innerHTML = attivi.map(p=>{
    const suo = p.id === (utenteOnline && utenteOnline.id);
    return `<div class="riga-profilo">
      <div class="info"><div class="nome">${p.nome || '(senza nome)'}${suo?' (tu)':''}</div>
        <div class="mail">${p.email} · ${conteggio(p)} allenamenti</div></div>
      <div class="azioni">
        <button data-pt="${p.id}" class="${p.is_pt?'ok':''}">${p.is_pt ? 'Togli PT' : 'Rendi PT'}</button>
        <button data-reset="${p.id}">Reimposta password</button>
        ${suo ? '' : `<button data-sospendi="${p.id}">Blocca</button>`}
        ${suo ? '' : `<button class="pericolo" data-canc="${p.id}">Elimina</button>`}
      </div></div>`;
  }).join('');

  const cambia = async (id, valori, messaggio)=>{
    const { error } = await sb.from('profili').update(valori).eq('id', id);
    if(error){ toast("Non riuscito: " + error.message); return; }
    toast(messaggio);
    renderAmministrazioneOnline();
  };

  boxAttesa.querySelectorAll('[data-appr]').forEach(b=>b.addEventListener('click', ()=>{
    const p = data.find(x=>x.id===b.dataset.appr);
    cambia(p.id, { approvato: true, bloccato: false }, `${p.nome || p.email} può entrare ✓`);
  }));
  boxAttesa.querySelectorAll('[data-rifiuta]').forEach(b=>b.addEventListener('click', ()=>{
    const p = data.find(x=>x.id===b.dataset.rifiuta);
    customConfirm(`Rifiutare la richiesta di ${p.email}? Account e profilo vengono eliminati del tutto: se in futuro rifà l'accesso (anche con Google), riparte da zero.`, async ()=>{
      const { data: res, error } = await sb.functions.invoke('elimina-account', { body: { userId: p.id } });
      const erroreVero = error || (res && res.error);
      toast(erroreVero ? ("Non riuscito: " + (error ? error.message : res.error)) : "Richiesta rifiutata");
      renderAmministrazioneOnline();
    });
  }));
  wrap.querySelectorAll('[data-pt]').forEach(b=>b.addEventListener('click', ()=>{
    const p = data.find(x=>x.id===b.dataset.pt);
    const diventa = !p.is_pt;
    customConfirm(
      diventa
        ? `Rendere ${p.nome || p.email} un Personal Trainer? Avrà un'area riservata e potrà seguire chi glielo chiede.`
        : `Togliere l'appellativo a ${p.nome || p.email}? Perderà l'area riservata. I rapporti già attivi vanno chiusi a parte.`,
      ()=>cambia(p.id, { is_pt: diventa }, diventa ? "Ora è Personal Trainer ✓" : "Appellativo rimosso"));
  }));

  // riepilogo: chi segue chi, senza entrare nei dati
  const boxPT = document.getElementById('riepilogoPT');
  const trainer = data.filter(p=>p.is_pt);
  if(trainer.length === 0){
    boxPT.innerHTML = '<div class="empty" style="padding:12px 0;">Nessun Personal Trainer. Usa "Rendi PT" qui sotto.</div>';
  } else {
    const { data: rap } = await sb.from('rapporti_pt').select('pt_id,cliente_id,stato');
    const perNome = {}; data.forEach(p=>{ perNome[p.id] = p.nome || p.email; });
    boxPT.innerHTML = trainer.map(t=>{
      const suoi = (rap||[]).filter(r=>r.pt_id === t.id);
      const attivi = suoi.filter(r=>r.stato === 'attivo');
      const attesa = suoi.filter(r=>r.stato === 'in_attesa').length;
      return `<div class="riga-profilo">
        <div class="info">
          <div class="nome">${t.nome || t.email}<span class="pt-badge">PT</span></div>
          <div class="mail">${attivi.length} seguiti${attesa ? ' · ' + attesa + ' in attesa' : ''}${
            attivi.length ? '<br>' + attivi.map(r=>perNome[r.cliente_id] || '?').join(', ') : ''}</div>
        </div></div>`;
    }).join('');
  }

  wrap.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click', ()=>{
    const p = data.find(x=>x.id===b.dataset.reset);
    customConfirm(
      `Mandare a ${p.email} il link per scegliere una nuova password?\n\n` +
      `Le password non sono leggibili da nessuno, nemmeno da te: sono conservate in forma cifrata. ` +
      `Con questo link la persona se ne imposta una nuova da sola.`,
      async ()=>{
        const { error } = await sb.auth.resetPasswordForEmail(p.email, { redirectTo: location.origin + location.pathname });
        toast(error ? ("Non riuscito: " + error.message) : `Link inviato a ${p.email} ✓`);
      });
  }));
  wrap.querySelectorAll('[data-sospendi]').forEach(b=>b.addEventListener('click', ()=>{
    const p = data.find(x=>x.id===b.dataset.sospendi);
    customConfirm(`Bloccare l'accesso a ${p.email}?\n\nNon potrà più entrare, ma scheda, allenamenti e dieta restano intatti: puoi riattivarlo quando vuoi dalle richieste in attesa.`, ()=>
      cambia(p.id, { approvato: false, bloccato: true }, `${p.nome || p.email} bloccato`));
  }));
  wrap.querySelectorAll('[data-canc]').forEach(b=>b.addEventListener('click', ()=>{
    const p = data.find(x=>x.id===b.dataset.canc);
    customConfirm(`Eliminare l'account di ${p.email} con tutti i suoi ${conteggio(p)} allenamenti? Viene cancellato anche l'accesso: se in futuro rifà il login (anche con Google), riparte da zero come un account nuovo. Non si torna indietro.`, async ()=>{
      const { data: res, error } = await sb.functions.invoke('elimina-account', { body: { userId: p.id } });
      const erroreVero = error || (res && res.error);
      toast(erroreVero ? ("Non riuscito: " + (error ? error.message : res.error)) : "Account eliminato");
      renderAmministrazioneOnline();
    });
  }));
}

function renderAmministrazione(){
  if(modalitaOnline()){ renderAmministrazioneOnline(); return; }
  const card = document.getElementById('cardAmministrazione');
  const amministratore = sonoAmministratore();

  card.style.display = amministratore ? 'block' : 'none';
  if(!amministratore) return;

  document.getElementById('statoIngresso').textContent =
    (state.appLock && state.appLock.predefinita) ? "quella iniziale (cambiala)" : "personalizzata";
  document.getElementById('statoIngresso').className =
    (state.appLock && state.appLock.predefinita) ? "warn" : "ok";

  // il ruolo Personal Trainer esiste solo online (richiede il rapporto
  // PT↔cliente su Supabase): offline la sotto-sezione resterebbe sempre
  // vuota, quindi la nascondo invece di mostrare un accordion senza niente dentro.
  const subPT = document.getElementById('subPT');
  if(subPT) subPT.style.display = 'none';
  const subPw = document.getElementById('subPwIngresso');
  if(subPw) subPw.style.display = '';

  const io = loggedInProfile();

  // ---- richieste in attesa ----
  const attesa = state.profiles.filter(p=>!p.approvato);
  const boxAttesa = document.getElementById('elencoAttesa');
  document.getElementById('contaAttesa').textContent = attesa.length ? `(${attesa.length})` : '';
  document.getElementById('contaProfili').textContent = state.profiles.filter(p=>p.approvato).length
    ? `(${state.profiles.filter(p=>p.approvato).length})` : '';
  const subRichieste = document.getElementById('subRichieste');
  if(subRichieste && !subRichieste.dataset.toccato){ subRichieste.open = attesa.length > 0; }
  if(attesa.length === 0){
    boxAttesa.innerHTML = '<div class="empty" style="padding:14px 0;">Nessuna richiesta in sospeso.</div>';
  } else {
    boxAttesa.innerHTML = attesa.map(p=>{
      const quando = p.richiestoIl ? new Date(p.richiestoIl) : null;
      const q = quando ? `${String(quando.getDate()).padStart(2,'0')}/${String(quando.getMonth()+1).padStart(2,'0')} alle ${String(quando.getHours()).padStart(2,'0')}:${String(quando.getMinutes()).padStart(2,'0')}` : '';
      return `<div class="riga-profilo attesa">
        <div class="info">
          <div class="nome">${p.name}</div>
          <div class="mail">${p.email || 'nessuna email'}${q ? ' · richiesta del ' + q : ''}</div>
        </div>
        <div class="azioni">
          <button class="approva" data-appr="${p.id}">Approva</button>
          <button class="pericolo" data-rifiuta="${p.id}">Rifiuta</button>
        </div>
      </div>`;
    }).join('');
    boxAttesa.querySelectorAll('[data-appr]').forEach(b=>b.addEventListener('click', ()=>{
      const prof = state.profiles.find(x=>x.id===b.dataset.appr);
      if(!prof) return;
      prof.approvato = true;
      prof.bloccato = false;
      save();
      renderAmministrazione();
      toast(`${prof.name} può entrare ✓`);
    }));
    boxAttesa.querySelectorAll('[data-rifiuta]').forEach(b=>b.addEventListener('click', ()=>{
      const prof = state.profiles.find(x=>x.id===b.dataset.rifiuta);
      if(!prof) return;
      customConfirm(`Rifiutare la richiesta di "${prof.name}" (${prof.email||'senza email'})? L'account verrà eliminato.`, ()=>{
        state.profiles = state.profiles.filter(x=>x.id!==prof.id);
        save();
        renderAmministrazione();
        toast("Richiesta rifiutata");
      });
    }));
  }

  // ---- profili già attivi ----
  const wrap = document.getElementById('elencoProfiliAmm');
  wrap.innerHTML = state.profiles.filter(p=>p.approvato).map(p=>{
    const suo = p.id === (io && io.id);
    const allen = (p.logs||[]).filter(l=>l.status==='registrato').length;
    return `<div class="riga-profilo">
      <div class="info">
        <div class="nome">${p.name}${suo?' (tu)':''}</div>
        <div class="mail">${p.email || 'nessuna email'} · ${allen} allenamenti</div>
      </div>
      <div class="azioni">
        <button data-reset="${p.id}">Reimposta password</button>
        ${suo ? '' : `<button data-sospendi="${p.id}">Sospendi</button>`}
        ${suo ? '' : `<button class="pericolo" data-canc="${p.id}">Elimina</button>`}
      </div>
    </div>`;
  }).join('');

  wrap.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click', ()=>{
    const prof = state.profiles.find(x=>x.id===b.dataset.reset);
    if(!prof) return;
    const nuova = generaCodice().replace('-','');
    customConfirm(`Reimpostare la password di "${prof.name}"? Diventerà: ${nuova}\nAnnotala e comunicagliela.`, ()=>{
      prof.passwordHash = simpleHash(nuova);
      save();
      toast(`Nuova password di ${prof.name}: ${nuova}`);
      copiaNegliAppunti(nuova);
    });
  }));
  wrap.querySelectorAll('[data-sospendi]').forEach(b=>b.addEventListener('click', ()=>{
    const prof = state.profiles.find(x=>x.id===b.dataset.sospendi);
    if(!prof) return;
    customConfirm(`Sospendere "${prof.name}"? Non potrà più entrare finché non lo riapprovi. I suoi dati restano.`, ()=>{
      prof.approvato = false;
      prof.bloccato = true;
      save();
      renderAmministrazione();
      toast(`${prof.name} sospeso`);
    });
  }));
  wrap.querySelectorAll('[data-canc]').forEach(b=>b.addEventListener('click', ()=>{
    const prof = state.profiles.find(x=>x.id===b.dataset.canc);
    if(!prof) return;
    const allen = (prof.logs||[]).filter(l=>l.status==='registrato').length;
    customConfirm(`Eliminare il profilo di "${prof.name}" (${prof.email||'senza email'})? Verranno cancellati per sempre ${allen} allenamenti, scheda e dieta.`, ()=>{
      state.profiles = state.profiles.filter(x=>x.id!==prof.id);
      save();
      renderAmministrazione();
      toast("Profilo eliminato");
    });
  }));
}

// "Richieste in attesa" si apre da sola quando c'è qualcosa da approvare, ma
// se l'admin la chiude a mano non deve riaprirsi da sola al render successivo
// (es. dopo aver approvato qualcun altro) finché non ce ne sono di nuove.
document.getElementById('subRichieste').addEventListener('toggle', function(){
  this.dataset.toccato = '1';
});

// Filtro per nome/email sui profili attivi: con tanti utenti la lista può
// allungarsi parecchio, qui si cerca invece di scorrere a mano.
document.getElementById('filtroProfiliAmm').addEventListener('input', function(){
  const q = this.value.trim().toLowerCase();
  document.querySelectorAll('#elencoProfiliAmm .riga-profilo').forEach(riga=>{
    riga.style.display = !q || riga.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

document.getElementById('cambiaPwIngressoBtn').addEventListener('click', ()=>{
  if(!sonoAmministratore()){ toast("Solo l'amministratore può cambiarla."); return; }
  const nuova = document.getElementById('nuovaPwIngresso').value.trim();
  if(nuova.length < 6){ toast("Usane una di almeno 6 caratteri."); return; }
  customConfirm(`Cambiare la password d'ingresso in "${nuova}"? Chi ha la vecchia non entrerà più.`, ()=>{
    const codice = generaCodice();
    state.appLock = { hash: simpleHash(nuova), recuperoHash: simpleHash(normalizzaCodice(codice)), predefinita: false };
    save();
    document.getElementById('nuovaPwIngresso').value = "";
    renderAmministrazione();
    customConfirm(`Password d'ingresso aggiornata.\n\nCodice di recupero (salvalo): ${codice}`, ()=>{});
    copiaNegliAppunti(codice);
  });
});



// ============================================================
// SINCRONIZZAZIONE ONLINE (Supabase)
// Se qui sotto ci sono indirizzo e chiave, l'app lavora con l'account online:
// stessi dati da qualsiasi telefono, da Safari e dall'app installata.
// Se restano vuoti, l'app continua a funzionare solo su questo dispositivo.
// ============================================================
// I due valori si mettono nel file "config.js", che è piccolo e facile da modificare.
// APP_CONFIG è il nome nuovo, neutro (non legato a nessun nome dell'app, così
// non andrà mai più rinominato). FITPRO_CONFIG resta come ripiego per non
// rompere config.js finché non lo aggiorni tu con calma.
const _CONFIG_LETTO   = window.APP_CONFIG || window.FITPRO_CONFIG || {};
const SUPABASE_URL    = _CONFIG_LETTO.url || "";
const SUPABASE_CHIAVE = _CONFIG_LETTO.chiave || "";

let sb = null;                 // collegamento a Supabase
let utenteOnline = null;       // account con cui sono entrato
let rigaOnline = null;         // la mia riga nella tabella profili
let _salvataggioInCorso = null;
let _daSincronizzare = false;
let _recuperoPasswordAttivo = false; // true tra il link "password dimenticata" nell'email e il salvataggio della nuova password

// configurato = l'app deve lavorare online, anche se la libreria non è ancora arrivata
function configurataOnline(){ return !!(SUPABASE_URL && SUPABASE_CHIAVE); }
function modalitaOnline(){ return configurataOnline() && typeof supabase !== 'undefined'; }

// la libreria arriva da internet: aspetto che sia pronta invece di ripiegare
// sulla schermata locale, che confonderebbe e mostrerebbe dati che non c'entrano
function attendiLibreria(millisecondi){
  const scadenza = Date.now() + (millisecondi || 12000);
  return new Promise(risolvi=>{
    (function controlla(){
      if(typeof supabase !== 'undefined') return risolvi(true);
      if(Date.now() > scadenza) return risolvi(false);
      setTimeout(controlla, 120);
    })();
  });
}

let _statoSyncTimeoutId = null;
function mostraStatoSync(stato, testo){
  const el = document.getElementById('cloudStato');
  if(!el) return;
  if(_statoSyncTimeoutId){ clearTimeout(_statoSyncTimeoutId); _statoSyncTimeoutId = null; }
  if(!modalitaOnline()){ el.classList.remove('show'); return; }
  el.classList.add('show');
  el.classList.toggle('sincronizzo', stato === 'sincronizzo');
  el.classList.toggle('offline', stato === 'offline');
  document.getElementById('cloudStatoTxt').textContent = testo;
  // "sincronizzato" è solo una conferma: non deve restare lì a coprire i
  // contenuti per sempre, sparisce da sola dopo un attimo. "offline"/
  // "sincronizzo" invece restano finché la situazione non cambia davvero,
  // perché segnalano qualcosa che l'utente potrebbe voler sapere.
  if(stato === 'ok'){
    _statoSyncTimeoutId = setTimeout(()=>{
      el.classList.remove('show');
      _statoSyncTimeoutId = null;
    }, 2200);
  }
}

// ============================================================
// SCHERMATA "ACCOUNT BLOCCATO"
// Un unico componente riusato in tutti i punti dove un profilo bloccato da
// chi gestisce l'app incontra il blocco: login online, password di un
// profilo locale bloccato, e blocco in tempo reale mentre si è già dentro
// l'app. `opzioni.testoAzione`/`opzioni.suAzione` sono facoltativi: senza,
// la schermata non ha alcun pulsante (blocco "duro", usato quando si viene
// buttati fuori mentre si è già dentro l'app); con, compare un unico link
// d'uscita/ritorno (usato quando la persona non ha ancora effettuato
// l'accesso, e le serve comunque un modo per tornare indietro).
// ============================================================
function mostraAccountBloccatoOverlay(opzioni){
  const overlay = document.getElementById('accountBloccatoOverlay');
  if(!overlay) return;
  const azione = document.getElementById('accountBloccatoAzione');
  if(opzioni && opzioni.testoAzione && opzioni.suAzione){
    azione.textContent = opzioni.testoAzione;
    azione.style.display = 'inline-block';
    azione.onclick = ()=>{ nascondiAccountBloccatoOverlay(); opzioni.suAzione(); };
  } else {
    azione.style.display = 'none';
    azione.onclick = null;
  }
  overlay.classList.add('show');
}
function nascondiAccountBloccatoOverlay(){
  const overlay = document.getElementById('accountBloccatoOverlay');
  if(overlay) overlay.classList.remove('show');
}

function iniziaSupabase(){
  if(!modalitaOnline()) return false;
  try{
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_CHIAVE, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    // Il link "password dimenticata" riporta qui con un token di tipo "recovery":
    // supabase-js lo intercetta da solo e apre una sessione temporanea, ma senza
    // questo listener non c'era NESSUN modo di accorgersene — l'app trattava quel
    // link come un login normale e la password vecchia non veniva mai sostituita.
    sb.auth.onAuthStateChange((evento)=>{
      if(evento === 'PASSWORD_RECOVERY') _recuperoPasswordAttivo = true;
    });
    return true;
  }catch(e){ console.error('Supabase non raggiungibile:', e); return false; }
}

// ============================================================
// VISIBILITÀ ERRORI IN PRODUZIONE
// Prima, se un utente vero incontrava un errore JS, nessuno lo sapeva finché
// non lo scriveva lui stesso. Qui catturiamo tutto quello che sfugge ai
// try/catch sparsi nel codice (window.onerror ed eventuali Promise rifiutate
// senza .catch) e lo mandiamo sulla tabella error_logs — sola scrittura per
// chi usa l'app, leggibile solo da chi ha accesso al progetto Supabase.
// Attivo solo quando l'app lavora online: chi la usa senza Supabase
// configurato (vedi js/config.js) resta com'era, nessun log da nessuna parte.
// ============================================================
const _erroriGiaSegnalati = new Set();   // evita di reinviare lo stesso errore decine di volte di fila
let _erroriSegnalatiSessione = 0;
const MAX_ERRORI_PER_SESSIONE = 25;      // tetto di sicurezza: mai spammare la tabella

function segnalaErroreClient(tipo, messaggio, stack, extra){
  try{
    if(!sb) return;      // sb è impostato solo da iniziaSupabase(), quindi solo quando l'app lavora online
    if(_erroriSegnalatiSessione >= MAX_ERRORI_PER_SESSIONE) return;
    const chiave = tipo + '|' + String(messaggio).slice(0,300) + '|' + String(stack||'').slice(0,200);
    if(_erroriGiaSegnalati.has(chiave)) return;
    _erroriGiaSegnalati.add(chiave);
    _erroriSegnalatiSessione++;
    // .catch(()=>{}) è essenziale: se l'insert stesso fallisse (rete assente,
    // tabella non raggiungibile) la Promise rifiutata finirebbe altrimenti
    // dentro il nostro stesso listener "unhandledrejection" qui sotto,
    // creando un log-dell'errore-di-log all'infinito.
    sb.from('error_logs').insert({
      tipo, messaggio: String(messaggio).slice(0,2000), stack: stack ? String(stack).slice(0,4000) : null,
      url: (typeof location !== 'undefined' ? location.href : null),
      user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : null),
      profilo_id: (rigaOnline && rigaOnline.id) || null,
      contesto: extra || null
    }).then(()=>{}, ()=>{});
  }catch(e){ /* il logging degli errori non deve mai generare altri errori */ }
}
window.addEventListener('error', (e)=>{
  segnalaErroreClient('errore', e.message || 'Errore sconosciuto', e.error && e.error.stack, {
    file: e.filename || null, riga: e.lineno || null, colonna: e.colno || null
  });
});
window.addEventListener('unhandledrejection', (e)=>{
  const r = e.reason;
  segnalaErroreClient('promise-rifiutata', (r && r.message) || String(r), r && r.stack, null);
});

