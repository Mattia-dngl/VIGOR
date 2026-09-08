const ICONA_SCARICA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4 20h16"/></svg>';
// Stessa matita usata dal lato cliente per "Modifica scheda"/"Modifica dieta"
// (#schedaEditBtn/#dietEditBtn in index.html) — la riuso qui per l'area PT.
const ICONA_MATITA_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

// ---------- scelta del trainer ----------
document.getElementById('chiediPTBtn').addEventListener('click', async ()=>{
  const box = document.getElementById('elencoPT');
  document.getElementById('sceltaPTOverlay').classList.add('show');
  box.innerHTML = '<div class="empty">Cerco i trainer disponibili…</div>';
  const { data, error } = await sb.from('profili')
    .select('id,nome,nome_pubblico,email,is_pt')
    .eq('is_pt', true).eq('approvato', true);
  if(error){ box.innerHTML = '<div class="empty">Non riesco a leggere l\'elenco: ' + error.message + '</div>'; return; }
  const disponibili = (data||[]).filter(p=>p.id !== utenteOnline.id);
  if(disponibili.length === 0){
    box.innerHTML = '<div class="empty">Non ci sono Personal Trainer disponibili al momento.</div>';
    return;
  }
  box.innerHTML = disponibili.map(p=>`
    <div class="pt-riga">
      <div class="info"><div class="nome">${escapeAttr(nomeDi(p))}</div><div class="meta">${escapeAttr(p.email)}</div></div>
      <div class="azioni"><button class="ok" data-chiedi="${p.id}">Chiedi</button></div>
    </div>`).join('');
  box.querySelectorAll('[data-chiedi]').forEach(b=>b.addEventListener('click', async ()=>{
    const pt = disponibili.find(x=>x.id === b.dataset.chiedi);
    const { error } = await sb.from('rapporti_pt').insert({
      cliente_id: utenteOnline.id, pt_id: pt.id, stato: 'in_attesa'
    });
    if(error){ toast("Non riuscito: " + error.message); return; }
    document.getElementById('sceltaPTOverlay').classList.remove('show');
    toast(`Richiesta inviata a ${nomeDi(pt)} ✓`);
    renderMioPT();
  }));
});
document.getElementById('sceltaPTChiudi').addEventListener('click', ()=>
  document.getElementById('sceltaPTOverlay').classList.remove('show'));
document.getElementById('sceltaPTOverlay').addEventListener('click', e=>{
  if(e.target.id === 'sceltaPTOverlay') e.currentTarget.classList.remove('show');
});


// ---------- area del Personal Trainer ----------
// Task 6a (roadmap): l'accesso all'area PT dipende dall'abbonamento, scritto
// SOLO dal webhook Stripe lato server (mai dal client). Nessuna riga in
// abbonamenti_pt (PT già esistenti da prima di questa funzione) o uno
// stato diverso da 'scaduto'/'pagamento_fallito' NON blocca mai: meglio
// lasciar passare un caso dubbio che chiudere fuori per errore un PT vero.
async function abbonamentoPTBloccato(){
  if(!sb || !utenteOnline) return false;
  try{
    const { data } = await sb.from('abbonamenti_pt').select('stato').eq('pt_id', utenteOnline.id).maybeSingle();
    return !!data && (data.stato === 'scaduto' || data.stato === 'pagamento_fallito');
  }catch(e){ console.error(e); return false; }
}

async function apriAreaPT(){
  if(await abbonamentoPTBloccato()){
    // I clienti del PT non c'entrano nulla: hanno un account e una sessione
    // propri, indipendenti da questo controllo — restano liberi di usare
    // l'app come sempre. A perdere l'accesso è solo la SUA area PT.
    mostraHome();
    mostraAvvisoPersistente("Il tuo piano PT non è attivo: l'area PT è momentaneamente sospesa. I tuoi clienti continuano a usare l'app normalmente. Vai su Account per vedere i piani.");
    return;
  }
  document.getElementById('homeScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('accountPanel').style.display = 'none';
  document.getElementById('areaPT').style.display = 'block';
  document.getElementById('ptDettaglio').style.display = 'none';
  document.getElementById('ptElenco').style.display = 'block';
  document.body.classList.add('area-pt');
  renderAreaPT();
}
async function chiudiAreaPT(){
  await chiudiEditorSchedaInlinePT();
  await chiudiEditorDietaInlinePT();
  document.getElementById('areaPT').style.display = 'none';
  document.body.classList.remove('area-pt');
  _clienteAperto = null;
  mostraHome();
}
document.getElementById('ptTornaHome').addEventListener('click', chiudiAreaPT);
document.getElementById('bannerPTTorna').addEventListener('click', tornaDaModificaPT);
// Guardia condivisa: vedi commento più sotto, sopra ai listener dei tab del cliente PT.
let _cambiandoTabPT = false;
document.getElementById('ptChiudiDettaglio').addEventListener('click', async ()=>{
  if(_cambiandoTabPT) return;
  _cambiandoTabPT = true;
  try{
    await chiudiEditorSchedaInlinePT();
    await chiudiEditorDietaInlinePT();
    document.getElementById('ptDettaglio').style.display = 'none';
    document.getElementById('ptElenco').style.display = 'block';
    window.scrollTo(0,0);
    _clienteAperto = null;
    renderAreaPT();
  } finally {
    _cambiandoTabPT = false;
  }
});

// ---------- barra di navigazione dedicata alla zona PT ----------
// Mockup fornito dall'utente (08/09/2026): sotto l'elenco atleti, una bottom
// bar SOLO per l'area PT (Atleti/Messaggi/Account) — vedi #navTabsPT in
// index.html. "Atleti" torna semplicemente all'elenco (chiude il dettaglio
// cliente se aperto, riusando il tasto "← Elenco" già esistente). "Messaggi"
// apre lo stesso overlay chat di sempre (apriMessaggiHome, in
// account/messaggi.js): resta sopra l'area PT senza doverla nascondere.
// "Account" invece nasconde l'area PT come fa apriAccountPanel() con
// Home/appRoot: chiudendo Account si torna qui (non alla Home del cliente)
// grazie a _accountApertoDallAreaPT, letto da chiudiAccountPanel() in
// account/account.js.
document.getElementById('ptNavAtletiBtn').addEventListener('click', ()=>{
  if(document.getElementById('ptDettaglio').style.display !== 'none'){
    document.getElementById('ptChiudiDettaglio').click();
  }
});
document.getElementById('ptNavMessaggiBtn').addEventListener('click', ()=>apriMessaggiHome());
document.getElementById('ptNavAccountBtn').addEventListener('click', ()=>{
  document.getElementById('areaPT').style.display = 'none';
  _accountApertoDallAreaPT = true;
  apriAccountPanel();
});

// Quanti giorni interi sono passati da una data ISO (yyyy-mm-dd) ad oggi.
// Ritorna null se la data manca o non è valida — così chi chiama può distinguere
// "non lo so" da "zero giorni fa".
function giorniDaOggi(iso){
  if(!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  if(isNaN(d.getTime())) return null;
  const oggi = new Date(new Date().toISOString().slice(0,10) + 'T00:00:00');
  return Math.round((oggi - d) / 86400000);
}
// Soglia oltre la quale un cliente fermo finisce nella vista d'insieme del PT.
const SOGLIA_INATTIVITA_PT_GIORNI = 7;

// Riassume, per un cliente seguito, i segnali utili al PT: da quanti giorni non
// si allena e se la scheda attiva ha una scadenza (impostata da PT o cliente,
// vedi #newProgramScadenza) già passata. Usata sia dalla vista d'insieme sia,
// potenzialmente, da altri punti che vorranno gli stessi calcoli in futuro.
function segnaliPT(p){
  const d = (p && p.dati) || {};
  const logsFatti = (d.logs || []).filter(l => l.status === 'registrato');
  const ultimo = logsFatti.map(l => l.date).sort().pop() || null;
  const giorniFermo = giorniDaOggi(ultimo);
  const prog = (d.programs || []).find(pr => pr.id === d.activeProgramId) || (d.programs || [])[0] || null;
  const giorniScadenza = prog && prog.scadenza ? giorniDaOggi(prog.scadenza) : null;
  return {
    allenamenti: logsFatti.length,
    ultimo,
    giorniFermo,                                   // null = non si è mai allenato
    fermoDaTroppo: giorniFermo === null || giorniFermo >= SOGLIA_INATTIVITA_PT_GIORNI,
    scheda: prog,
    scadenzaPassata: giorniScadenza !== null && giorniScadenza > 0
  };
}

async function renderAreaPT(){
  await caricaRapporti();
  const miei = _rapporti.filter(r => r.pt_id === utenteOnline.id);
  const richieste = miei.filter(r => r.stato === 'in_attesa');
  const attivi = miei.filter(r => r.stato === 'attivo');

  // persone seguite — caricate una volta sola e riusate sia dalla vista d'insieme
  // ("cose da guardare oggi") sia dall'elenco clienti qui sotto.
  const profiliAttivi = attivi.length ? await Promise.all(attivi.map(r=>leggiProfilo(r.cliente_id))) : [];
  const segnali = profiliAttivi.map(p => p ? segnaliPT(p) : null);

  const fermi = [];
  const scaduti = [];
  attivi.forEach((r,i)=>{
    const p = profiliAttivi[i], s = segnali[i];
    if(!p) return;
    if(s.fermoDaTroppo) fermi.push({r, p, s});
    if(s.scadenzaPassata) scaduti.push({r, p, s});
  });
  const totaleOggi = richieste.length + fermi.length + scaduti.length;
  const attiviQuestaSettimana = segnali.filter(s => s && !s.fermoDaTroppo).length;

  document.getElementById('ptSottotitolo').textContent =
    (attivi.length === 0 ? "Nessuna persona seguita"
      : attivi.length === 1 ? "1 persona seguita" : `${attivi.length} persone seguite`)
    + (totaleOggi ? ` · ${totaleOggi === 1 ? '1 cosa' : totaleOggi + ' cose'} da guardare oggi` : '');
  document.getElementById('ptContaRichieste').textContent = richieste.length ? `(${richieste.length})` : '';
  document.getElementById('ptContaOggi').textContent = totaleOggi ? `(${totaleOggi})` : '';

  // ---- header: i numeri chiave a colpo d'occhio, invece di solo un titolo ----
  // Icona in un pallino nell'angolo di ogni chip (mockup 08/09/2026): un
  // segno di spunta per "Seguiti", un "+" per "Richieste", un calendario per
  // "Attivi in sett." — solo estetico, nessuna delle tre cambia significato.
  const ICONA_PTH_SEGUITI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7"/></svg>';
  const ICONA_PTH_RICHIESTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const ICONA_PTH_ATTIVI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8 3.5v3M16 3.5v3"/></svg>';
  document.getElementById('ptHeroStats').innerHTML = `
    <div class="pth-chip"><span class="pth-chip-icon ok">${ICONA_PTH_SEGUITI}</span><b>${attivi.length}</b><span>Seguiti</span></div>
    <div class="pth-chip${richieste.length ? ' accent' : ''}"><span class="pth-chip-icon">${ICONA_PTH_RICHIESTE}</span><b>${richieste.length}</b><span>Richieste</span></div>
    <div class="pth-chip"><span class="pth-chip-icon">${ICONA_PTH_ATTIVI}</span><b>${attiviQuestaSettimana}</b><span>Attivi in sett.</span></div>`;

  // ---- vista d'insieme: "cose da guardare oggi" come griglia a due colonne
  // di card-persona (mockup 08/09/2026: foto, badge di stato, nome, stato,
  // barra e tasto "Apri" a piena larghezza — non più la striscia scorrevole
  // di alert compatti di prima). freshnessDi() è dichiarata più sotto in
  // questa stessa funzione ma è una function e quindi già disponibile qui.
  const boxOggi = document.getElementById('ptOggi');
  if(totaleOggi === 0){
    boxOggi.innerHTML = '<div class="pt-empty-banner">Tutto in ordine: nessuna richiesta in sospeso, nessuno fermo da troppo e nessun piano scaduto ✓</div>';
  } else {
    const personaCard = (tipo, badge, p, meta, fr, attrs)=>`<button type="button" class="pt-oggi-card ${tipo}" ${attrs}>
        <div class="pt-oggi-top">
          <div class="pt-avatar">${avatarContentHtml(nomeDi(p), (p.dati||{}).avatarUrl)}</div>
          <span class="pt-oggi-badge">${badge}</span>
        </div>
        <div class="pt-oggi-nome">${escapeAttr(nomeDi(p))}</div>
        <div class="pt-oggi-status">${escapeAttr(meta)}</div>
        <div class="pt-fresh"><i style="width:${fr.pct}%; background:${fr.colore};"></i></div>
        <span class="pt-apri-pill block">Apri</span>
      </button>`;
    const cards = [];
    if(richieste.length){
      cards.push(`<button type="button" class="pt-oggi-card accent no-avatar" data-vai-richieste="1">
          <div class="pt-oggi-top">
            <div class="pt-oggi-icon">${ICONA_PTH_RICHIESTE}</div>
            <span class="pt-oggi-badge">RICHIESTE</span>
          </div>
          <div class="pt-oggi-nome">${richieste.length}</div>
          <div class="pt-oggi-status">${richieste.length===1?'richiesta da accettare o rifiutare':'richieste da accettare o rifiutare'}</div>
          <span class="pt-apri-pill block">Vedi sotto</span>
        </button>`);
    }
    fermi.forEach(v=>cards.push(personaCard('warn', v.s.giorniFermo===null ? 'INATTIVO' : 'ATTENZIONE', v.p,
      v.s.giorniFermo===null ? 'Non si è allenato' : `Fermo da ${v.s.giorniFermo} giorni`,
      freshnessDi(v.s), `data-apri-oggi="${v.r.cliente_id}"`)));
    scaduti.forEach(v=>cards.push(personaCard('danger', 'SCADUTO', v.p,
      `Scheda "${v.s.scheda.name}" scaduta il ${formatDate(v.s.scheda.scadenza)}`,
      freshnessDi(v.s), `data-apri-oggi="${v.r.cliente_id}"`)));
    boxOggi.innerHTML = `<div class="pt-oggi-grid">${cards.join('')}</div>`;
    boxOggi.querySelectorAll('[data-apri-oggi]').forEach(b=>b.addEventListener('click', ()=>apriCliente(b.dataset.apriOggi)));
    const vaiRichieste = boxOggi.querySelector('[data-vai-richieste]');
    if(vaiRichieste) vaiRichieste.addEventListener('click', ()=>{
      document.getElementById('ptRichiesteCard').scrollIntoView({behavior:'smooth', block:'start'});
    });
  }

  // richieste ricevute — carosello di card persona invece di un elenco impilato
  const boxR = document.getElementById('ptRichieste');
  if(richieste.length === 0){
    boxR.innerHTML = '<div class="empty" style="padding:12px 0;">Nessuna richiesta in sospeso.</div>';
  } else {
    const profili = await Promise.all(richieste.map(r=>leggiProfilo(r.cliente_id)));
    boxR.innerHTML = `<div class="pt-scroll-row">${richieste.map((r,i)=>{
      const p = profili[i] || {};
      return `<div class="pt-req-card">
        <div class="pt-avatar">${avatarContentHtml(nomeDi(p), (p.dati||{}).avatarUrl)}</div>
        <div><div class="nome">${escapeAttr(nomeDi(p))}</div>
          <div class="meta">richiesta del ${formatDate((r.richiesto_il||'').slice(0,10))}</div></div>
        <div class="pt-req-btns">
          <button type="button" class="pt-icon-btn ok" data-accetta="${r.id}" aria-label="Accetta ${escapeAttr(nomeDi(p))}">✓</button>
          <button type="button" class="pt-icon-btn no" data-rifiuta-r="${r.id}" aria-label="Rifiuta ${escapeAttr(nomeDi(p))}">✕</button>
        </div></div>`;
    }).join('')}</div>`;
    boxR.querySelectorAll('[data-accetta]').forEach(b=>b.addEventListener('click', async ()=>{
      const { error } = await sb.from('rapporti_pt').update({ stato:'attivo' }).eq('id', b.dataset.accetta);
      toast(error ? ("Non riuscito: " + error.message) : "Ora segui questa persona ✓");
      renderAreaPT();
    }));
    boxR.querySelectorAll('[data-rifiuta-r]').forEach(b=>b.addEventListener('click', ()=>{
      customConfirm("Rifiutare la richiesta?", async ()=>{
        await sb.from('rapporti_pt').update({ stato:'rifiutato' }).eq('id', b.dataset['rifiutaR']);
        toast("Richiesta rifiutata");
        renderAreaPT();
      });
    }));
  }

  // persone seguite — griglia a due colonne; chi ha bisogno di attenzione
  // oggi (fermo o scheda scaduta) riceve una card a piena larghezza invece
  // di una riga identica alle altre.
  const boxC = document.getElementById('ptClienti');
  if(attivi.length === 0){
    boxC.innerHTML = '<div class="empty" style="padding:12px 0;">Non segui ancora nessuno. Le richieste che ricevi compaiono qui sopra.</div>';
    return;
  }
  const profili = profiliAttivi;

  function freshnessDi(s){
    const frac = s.giorniFermo === null ? 0.06 : Math.max(0.08, 1 - s.giorniFermo / (s.fermoDaTroppo ? 14 : 7));
    const colore = s.fermoDaTroppo ? 'var(--accent)' : (s.giorniFermo <= 2 ? 'var(--ok)' : 'var(--warn)');
    return { pct: Math.round(frac*100), colore };
  }

  // Riga di una persona seguita (mockup 08/09/2026): stessa forma per chi è
  // in evidenza (fermo/scaduto, tinta d'allarme) e per chi è in regola —
  // avatar, nome, una riga di stato, barra sottile, tasto "Apri" a destra.
  function clienteRow(tipo, r, p, statusText, fr){
    const d = p.dati || {};
    return `<div class="pt-client-wrap">
        <button type="button" class="pt-client-row${tipo ? ' ' + tipo : ''}" data-apri="${r.cliente_id}">
          <div class="pt-avatar">${avatarContentHtml(nomeDi(p), d.avatarUrl)}</div>
          <div class="pt-client-row-info">
            <div class="nome">${escapeAttr(nomeDi(p))}</div>
            <div class="status">${escapeAttr(statusText)}</div>
            <div class="pt-fresh"><i style="width:${fr.pct}%; background:${fr.colore};"></i></div>
          </div>
          <span class="pt-apri-pill">Apri</span>
        </button>
        <button type="button" class="pt-termina-link" data-chiudi="${r.id}">↗ Termina rapporto</button>
      </div>`;
  }

  function schedaCard(r, p, s){
    const d = p.dati || {};
    const allen = (d.logs||[]).filter(l=>l.status==='registrato').length;
    return clienteRow('', r, p, `${allen} allenament${allen===1?'o':'i'}`, freshnessDi(s));
  }

  function spotlightCard(r, p, s){
    const motivi = [];
    if(s.fermoDaTroppo) motivi.push(s.giorniFermo===null ? 'non si è ancora allenato' : `fermo da ${s.giorniFermo} giorni`);
    if(s.scadenzaPassata) motivi.push('scheda scaduta');
    return clienteRow('spotlight', r, p, motivi.join(' · '), freshnessDi(s));
  }

  const righe = attivi.map((r,i)=>({r, p: profili[i]||{}, s: segnali[i]})).filter(v=>v.p && v.p.id);
  const inEvidenza = righe.filter(v=>v.s.fermoDaTroppo || v.s.scadenzaPassata);
  const normali = righe.filter(v=>!(v.s.fermoDaTroppo || v.s.scadenzaPassata));

  boxC.innerHTML = `<div class="pt-client-grid">
      ${inEvidenza.map(v=>spotlightCard(v.r, v.p, v.s)).join('')}
      ${normali.map(v=>schedaCard(v.r, v.p, v.s)).join('')}
    </div>`;

  boxC.querySelectorAll('[data-apri]').forEach(b=>b.addEventListener('click', ()=>apriCliente(b.dataset.apri)));
  boxC.querySelectorAll('[data-chiudi]').forEach(b=>b.addEventListener('click', ()=>{
    const r = attivi.find(x=>x.id === b.dataset.chiudi);
    const p = profili[attivi.indexOf(r)] || {};
    customConfirm(`Terminare il rapporto con ${nomeDi(p)}? Non vedrai più i suoi dati. Può sempre richiederti di nuovo.`,
      ()=>terminaRapporto(r.id));
  }));
}

// ---------- dettaglio di un cliente ----------
async function apriCliente(clienteId){
  const rapporto = _rapporti.find(r=>r.cliente_id === clienteId && r.pt_id === utenteOnline.id && r.stato === 'attivo');
  if(!rapporto){ toast("Rapporto non più attivo."); renderAreaPT(); return; }
  const p = await leggiProfilo(clienteId);
  if(!p){ toast("Non riesco a leggere i dati di questa persona."); return; }
  _clienteAperto = { riga: p, rapporto };
  document.getElementById('ptClienteNome').textContent = nomeDi(p);
  document.getElementById('ptClienteMail').textContent = p.email || '';
  document.getElementById('ptClienteAvatar').innerHTML = avatarContentHtml(nomeDi(p), (p.dati||{}).avatarUrl);
  document.getElementById('ptElenco').style.display = 'none';
  document.getElementById('ptDettaglio').style.display = 'block';
  window.scrollTo(0,0);
  document.querySelectorAll('.pt-tab').forEach(t=>t.classList.toggle('active', t.dataset.pttab === 'riepilogo'));
  await renderDettaglioPT('riepilogo');
}

// Cambiare tab (Riepilogo/Scheda/Dieta/Storico) comporta chiudere l'editor
// precedente, che include un salvataggio di rete (salvaModifichePT). Se un
// secondo tap arriva mentre il primo sta ancora salvando, prima potevano
// sovrapporsi due chiusure contemporanee e il contenuto mostrato restava
// quello del tab vecchio anche se il tab evidenziato era il nuovo — da qui il
// "si impalla / si bugga". Questo blocco impedisce che un secondo cambio tab
// parta prima che il primo sia finito del tutto.
document.querySelectorAll('.pt-tab').forEach(t=>t.addEventListener('click', async ()=>{
  if(_cambiandoTabPT || t.classList.contains('active')) return;
  _cambiandoTabPT = true;
  const tabs = document.querySelector('.pt-tabs');
  tabs.style.opacity = '.6';
  tabs.style.pointerEvents = 'none';
  try{
    await chiudiEditorSchedaInlinePT();
    await chiudiEditorDietaInlinePT();
    document.querySelectorAll('.pt-tab').forEach(x=>x.classList.toggle('active', x===t));
    await renderDettaglioPT(t.dataset.pttab);
  } finally {
    _cambiandoTabPT = false;
    tabs.style.opacity = '';
    tabs.style.pointerEvents = '';
  }
}));

// Foto di check-in su Storage (bucket privato "checkin-foto"): il record ha
// solo il path (c.fotoPath), mai l'URL vero — va firmato al momento, un solo
// giro per tutte le foto della pagina invece di una chiamata per miniatura.
// Non lancia mai: se Storage non risponde, quelle foto restano non mostrate
// (meglio della sezione check-in che non si apre affatto) e i check-in più
// vecchi non ancora migrati (c.fotoUrl, base64) restano comunque visibili
// perché non passano da qui.
async function urlFirmateCheckinFoto(checkins){
  const paths = [...new Set(checkins.map(c=>c.fotoPath).filter(Boolean))];
  if(paths.length === 0 || typeof sb === 'undefined' || !sb) return {};
  try{
    const { data, error } = await sb.storage.from('checkin-foto').createSignedUrls(paths, 3600);
    if(error || !data) return {};
    const mappa = {};
    data.forEach(riga=>{ if(riga && !riga.error && riga.signedUrl) mappa[riga.path] = riga.signedUrl; });
    return mappa;
  }catch(e){
    console.error(e);
    return {};
  }
}

async function renderDettaglioPT(sezione){
  if(!_clienteAperto) return;
  const d = _clienteAperto.riga.dati || {};
  const r = _clienteAperto.rapporto;
  const box = document.getElementById('ptDettaglioCorpo');
  const logs = (d.logs || []).filter(l=>l.status === 'registrato').sort((a,b)=>b.date.localeCompare(a.date));
  const prog = (d.programs || []).find(p=>p.id === d.activeProgramId) || (d.programs||[])[0];

  if(sezione === 'riepilogo'){
    const saltati = (d.logs||[]).filter(l=>l.status === 'saltato').length;
    const ultimo = logs[0];
    const mis = (d.measurements||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const primoPeso = mis.find(m=>m.weight), ultimoPeso = [...mis].reverse().find(m=>m.weight);
    box.innerHTML = `
      <div class="card">
        <h3>Come sta andando</h3>
        <div class="pt-riepilogo-stats">
          <div class="pt-riepilogo-stat"><b>${logs.length}</b><span>Allenamenti</span></div>
          <div class="pt-riepilogo-stat"><b>${saltati}</b><span>Saltati</span></div>
          <div class="pt-riepilogo-stat"><b>${ultimo ? formatDate(ultimo.date) : '—'}</b><span>Ultimo</span></div>
        </div>
        <div class="dato-riga"><span>Scheda attiva</span><b>${prog ? prog.name : 'nessuna'}</b></div>
        ${primoPeso && ultimoPeso ? `<div class="dato-riga"><span>Peso</span><b>${primoPeso.weight} → ${ultimoPeso.weight} kg</b></div>` : ''}
      </div>
      <div class="card">
        <h3>Cosa posso fare</h3>
        <p class="hint">I permessi li decide la persona che segui, dalla sua scheda.</p>
        <div class="dato-riga"><span>Modificare la scheda</span><b class="${r.puo_scheda?'ok':'warn'}">${r.puo_scheda?'sì':'no'}</b></div>
        <div class="dato-riga"><span>Modificare la dieta</span><b class="${r.puo_dieta?'ok':'warn'}">${r.puo_dieta?'sì':'no'}</b></div>
        <button class="btn secondary block" id="apriMessaggiPTBtn" style="margin-top:10px;">${ICONA_CHAT_SVG} Messaggi</button>
      </div>`;
    document.getElementById('apriMessaggiPTBtn').addEventListener('click', ()=>apriMessaggi(r.id, _clienteAperto.riga.id, nomeDi(_clienteAperto.riga)));
    return;
  }

  if(sezione === 'storico'){
    box.innerHTML = `<div class="card"><h3>Storico allenamenti</h3>${
      logs.length === 0 ? '<div class="empty">Nessun allenamento registrato.</div>'
      : logs.slice(0,40).map(l=>`
        <div class="pt-scheda-ro">
          <div style="display:flex; justify-content:space-between; gap:10px;">
            <b>${formatDate(l.date)}</b><span class="hint">${l.dayName || 'Libero'}</span>
          </div>
          ${(l.exercises||[]).map(e=>`<div class="hint" style="margin-top:4px;">${e.name}: ${descriviSerie(e.sets||[], e.name)}</div>`).join('')}
          ${l.notes ? `<div class="hint" style="margin-top:6px; font-style:italic;">"${l.notes}"</div>` : ''}
        </div>`).join('')}</div>`;
    return;
  }

  if(sezione === 'scheda'){
    const puo = r.puo_scheda;
    const nomeCliente = nomeDi(_clienteAperto.riga);
    box.innerHTML = `
      <div id="ptSchedaViewWrap">
        <div class="scheda-header-row">
          <h2 class="scheda-titolo">Scheda di ${escapeAttr(nomeCliente)}</h2>
          ${puo ? `<div class="scheda-header-actions">
              <button type="button" class="btn-nuova-scheda" id="ptNuovaSchedaBtn">+ Nuova scheda</button>
              <button type="button" class="icon-btn-round" id="ptSchedaEditBtn" aria-label="Modifica scheda" title="Modifica scheda">${ICONA_MATITA_SVG}</button>
            </div>` : ''}
        </div>
        <div class="card">
          ${puo ? `<p class="hint">Le modifiche arrivano subito sul telefono di ${escapeAttr(nomeCliente)}.</p>`
                : '<p class="hint">Per modificarla serve che la persona ti dia il permesso dalla sua scheda.</p>'}
          ${!prog ? '<div class="empty">Nessuna scheda impostata.</div>' : `
            <div class="pt-scheda-ro"><b>${prog.name}</b> <span class="hint">dal ${formatDate(prog.createdAt)}${prog.scadenza ? ' · scadenza ' + formatDate(prog.scadenza) + (giorniDaOggi(prog.scadenza) > 0 ? ' (scaduta)' : '') : ''}</span></div>
            ${(prog.days||[]).map(g=>`
              <div class="pt-scheda-ro">
                <b>${g.key} · ${g.name}</b> <span class="hint">${g.weekday || 'senza giorno fisso'}</span>
                ${(g.exercises||[]).map((e,ei)=>{
                  // Numero d'ordine + nota a scomparsa (26/09/2026): prima le
                  // note del PT stavano sempre aperte e senza numerazione
                  // degli esercizi, la vista occupava troppo spazio verticale.
                  // Ora <details> nasconde la nota finché non ci si clicca
                  // sopra il badge 📌 (niente per gli esercizi senza nota).
                  const riga = `<span class="day-view-ex-num">${ei+1}</span><span>${e.name} — ${descriviTargetSerie(e)}${etichettaTecnica(e,g)}</span>`;
                  return e.note
                    ? `<details class="ex-note-toggle" style="margin-top:4px;"><summary class="hint" style="display:flex; align-items:center; gap:7px; cursor:pointer;">${riga}<span class="ex-note-badge">📌<svg class="ex-note-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span></summary><div class="exercise-note" style="margin:4px 0 4px 25px;">${escapeAttr(e.note)}</div></details>`
                    : `<div class="hint" style="display:flex; align-items:center; gap:7px; margin-top:4px;">${riga}</div>`;
                }).join('')}
              </div>`).join('')}
          `}
        </div>
      </div>
      ${puo ? '<div id="ptSchedaEditorSlot" style="display:none;"></div>' : ''}`;
    if(puo){
      document.getElementById('ptSchedaEditBtn').addEventListener('click', ()=>apriEditorSchedaPT('modifica'));
      document.getElementById('ptNuovaSchedaBtn').addEventListener('click', ()=>{
        customConfirm(`Iniziare una scheda nuova da zero per ${nomeCliente}? La scheda attuale resta invariata finché non premi "Salva scheda".`,
          ()=>apriEditorSchedaPT('nuova'));
      });
    }
    segnaVistaPT('scheda');
    return;
  }

  if(sezione === 'dieta'){
    const puo = r.puo_dieta;
    const dieta = prog ? prog.diet : null;
    let righeGiorni;
    if(!dieta || typeof dieta === 'string'){
      righeGiorni = dieta ? `<div class="pt-scheda-ro" style="white-space:pre-wrap;">${escapeAttr(dieta)}</div>` : '';
    } else {
      righeGiorni = WD_ORDER.map(wd=>{
        const day = dieta[wd];
        if(!day) return '';
        if(day.libera){
          return `<div class="pt-scheda-ro"><b>${wd}</b> <span class="hint">giorno libero / sgarro</span>
              ${day.testo ? `<div class="hint" style="margin-top:4px;">${day.testo}</div>` : ''}</div>`;
        }
        return `<div class="pt-scheda-ro"><b>${wd}</b>
            <div class="hint">Colazione: ${day.colazione||'-'}</div>
            <div class="hint">Pranzo: ${day.pranzo||'-'}</div>
            <div class="hint">Spuntino: ${day.spuntino||'-'}</div>
            <div class="hint">Cena: ${day.cena||'-'}</div></div>`;
      }).join('');
    }
    const nomeCliente = nomeDi(_clienteAperto.riga);
    box.innerHTML = `
      <div id="ptDietaViewWrap">
        <div class="scheda-header-row">
          <h2 class="scheda-titolo diet">Dieta di ${escapeAttr(nomeCliente)}</h2>
          ${puo ? `<div class="scheda-header-actions">
              <button type="button" class="icon-btn-round" id="ptDietaEditBtn" aria-label="Modifica dieta" title="Modifica dieta">${ICONA_MATITA_SVG}</button>
            </div>` : ''}
        </div>
        <div class="card">
          ${puo ? `<p class="hint">Le modifiche arrivano subito sul telefono di ${escapeAttr(nomeCliente)}.</p>`
                : '<p class="hint">Per modificarla serve che la persona ti dia il permesso.</p>'}
          ${righeGiorni ? righeGiorni : '<div class="empty">Nessun piano alimentare impostato.</div>'}
        </div>
      </div>
      ${puo ? '<div id="ptDietaEditorSlot" style="display:none;"></div>' : ''}`;
    if(puo){
      document.getElementById('ptDietaEditBtn').addEventListener('click', ()=>mostraEditorDietaInlinePT());
    }
    segnaVistaPT('dieta');
  }

  if(sezione === 'checkin'){
    const checkins = (d.checkins || []).slice().sort((a,b)=>b.data.localeCompare(a.data));
    // il PT ha appena guardato questa sezione: segno come vista, così le
    // notifiche (bell/lista, vedi renderNotifiche in home.js) smettono di
    // segnalare i check-in già visti qui.
    segnaVistaPT('checkin');
    // Le foto migrate su Storage hanno solo il path (c.fotoPath): serve un
    // URL firmato per mostrarle, un giro solo per tutte prima di disegnare
    // la pagina. I check-in vecchi non ancora migrati (c.fotoUrl, base64)
    // non hanno bisogno di niente e restano visibili comunque.
    const urlFirmate = await urlFirmateCheckinFoto(checkins);
    const fotoDaMostrare = c => c.fotoPath ? urlFirmate[c.fotoPath] : c.fotoUrl;
    box.innerHTML = `
      <div class="card">
        <h3>Check-in periodico</h3>
        <p class="hint">Chiedi alla persona di aggiornarti su peso, foto e sensazioni ogni tot settimane — decide sempre lei se e quando compilarlo, tu scegli solo ogni quanto chiederglielo.</p>
        <label class="checkbox-row" style="margin-top:10px;">
          <input type="checkbox" id="checkinAttivoToggle" ${r.checkin_attivo?'checked':''}>
          Attiva il check-in periodico
        </label>
        ${r.checkin_attivo ? `
          <div class="ex-field" style="margin-top:10px; max-width:220px;">
            <span class="ex-field-label">Ogni quante settimane</span>
            <select id="checkinCadenzaSelect">
              ${[1,2,3,4,6,8].map(n=>`<option value="${n}" ${r.checkin_cadenza_settimane===n?'selected':''}>${n} settiman${n===1?'a':'e'}</option>`).join('')}
            </select>
          </div>` : ''}
      </div>
      <div class="card">
        <h3>Storico</h3>
        ${!r.checkin_attivo ? '<p class="hint">Attiva il check-in qui sopra per iniziare a raccoglierlo.</p>'
          : checkins.length===0 ? '<p class="empty">Nessun check-in ancora compilato.</p>'
          : `${graficoPesoCheckinSvg(checkins)}${checkins.map((c,i)=>{
              // la didascalia (data/sensazione/nota) è la stessa sia che ci
              // sia la foto sia che non ci sia: solo il contenitore cambia
              // (card "post" quadrata con foto in cima, o riga semplice).
              const didascalia = `
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:baseline;">
                  <b>${formatDate(c.data)}</b>
                  <span class="mono">${c.peso!=null ? c.peso+' kg' : '—'}</span>
                </div>
                ${c.sensazione ? `<div class="hint">Sensazione: ${c.sensazione}/5</div>` : ''}
                ${c.nota ? `<div class="hint" style="margin-top:2px; font-style:italic;">"${escapeAttr(c.nota)}"</div>` : ''}`;
              const foto = fotoDaMostrare(c);
              if(!foto) return `<div class="pt-scheda-ro">${didascalia}</div>`;
              return `<div class="pt-scheda-ro checkin-post">
                  <button type="button" class="checkin-post-foto" data-foto-idx="${i}"><img src="${foto}" alt="Foto progresso del ${formatDate(c.data)}"></button>
                  <div class="checkin-post-caption">${didascalia}</div>
                  <button type="button" class="checkin-post-scarica" data-foto-idx="${i}" title="Scarica la foto originale" aria-label="Scarica la foto">${ICONA_SCARICA_SVG}</button>
                </div>`;
            }).join('')}`}
      </div>`;
    const chkAttivo = document.getElementById('checkinAttivoToggle');
    if(chkAttivo) chkAttivo.addEventListener('change', e=>impostaCheckinCliente(r.id, { checkin_attivo: e.target.checked }));
    const chkCadenza = document.getElementById('checkinCadenzaSelect');
    if(chkCadenza) chkCadenza.addEventListener('change', e=>impostaCheckinCliente(r.id, { checkin_cadenza_settimane: parseInt(e.target.value)||1 }));
    box.querySelectorAll('.checkin-post-foto').forEach(btn=>{
      const c = checkins[parseInt(btn.dataset.fotoIdx)];
      const didascalia = `${formatDate(c.data)}${c.peso!=null ? ' · ' + c.peso + ' kg' : ''}`;
      btn.addEventListener('click', ()=>apriFotoIngrandita(fotoDaMostrare(c), didascalia, `check-in-${c.data}.jpg`));
    });
    box.querySelectorAll('.checkin-post-scarica').forEach(btn=>{
      const c = checkins[parseInt(btn.dataset.fotoIdx)];
      btn.addEventListener('click', e=>{ e.stopPropagation(); scaricaFotoCheckin(fotoDaMostrare(c), `check-in-${c.data}.jpg`); });
    });
  }
}

// Foto di un check-in a schermo intero (dallo storico, lato PT): prima la
// foto non si vedeva affatto lì, solo la scritta "foto allegata". A
// differenza della card quadrata (ritagliata 1:1, in stile "post") qui si
// vede la foto intera, con una didascalia opzionale sotto (data/peso) e un
// tasto per scaricarla (stessa foto della miniatura: qui la si vede solo
// più comoda a schermo intero, per la qualità piena conviene scaricarla).
let _fotoIngranditaCorrente = { url: null, nomeFile: null };
function apriFotoIngrandita(url, didascalia, nomeFile){
  document.getElementById('fotoIngranditaImg').src = url;
  const cap = document.getElementById('fotoIngranditaCaption');
  cap.textContent = didascalia || '';
  cap.style.display = didascalia ? 'block' : 'none';
  _fotoIngranditaCorrente = { url, nomeFile: nomeFile || 'foto-check-in.jpg' };
  document.getElementById('fotoIngranditaOverlay').classList.add('show');
}
function chiudiFotoIngrandita(){
  document.getElementById('fotoIngranditaOverlay').classList.remove('show');
  // niente src="" (vedi commento in checkin-cliente.js): removeAttribute evita
  // che il browser la interpreti come "carica la pagina corrente come immagine".
  document.getElementById('fotoIngranditaImg').removeAttribute('src');
  _fotoIngranditaCorrente = { url: null, nomeFile: null };
}
document.getElementById('fotoIngranditaChiudi').addEventListener('click', chiudiFotoIngrandita);
document.getElementById('fotoIngranditaScarica').addEventListener('click', ()=>{
  if(_fotoIngranditaCorrente.url) scaricaFotoCheckin(_fotoIngranditaCorrente.url, _fotoIngranditaCorrente.nomeFile);
});
document.getElementById('fotoIngranditaOverlay').addEventListener('click', e=>{
  if(e.target.id === 'fotoIngranditaOverlay') chiudiFotoIngrandita();
});

// Scaricare la foto di un check-in: un <a download href="data:...">
// funzionava su desktop ma su Safari/iOS un link download con una data:
// URI spesso non fa nulla (Safari non la considera un file da salvare).
// Qui si converte la data: URI in un vero Blob e si sceglie il modo più
// affidabile per la piattaforma corrente:
// - iOS: si passa dal foglio di condivisione nativo (navigator.share con
//   un File), che su Safari è l'unico modo affidabile per arrivare a
//   "Salva immagine" — un link scaricabile lì viene ignorato;
// - altrove: download diretto via <a download> su un blob: URL (funziona
//   su Chrome/Firefox/Edge desktop e su Android).
// Se anche questo fallisce, si apre la foto in una scheda a sé: da lì si
// può comunque salvarla tenendo il dito premuto sopra.
async function scaricaFotoCheckin(url, nomeFile){
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  try{
    const risposta = await fetch(url);
    const blob = await risposta.blob();
    const file = new File([blob], nomeFile, { type: blob.type || 'image/jpeg' });
    if(iOS && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })){
      await navigator.share({ files: [file] });
      return;
    }
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = nomeFile;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(blobUrl), 4000);
  }catch(e){
    if(e && e.name === 'AbortError') return; // l'utente ha chiuso il foglio di condivisione
    window.open(url, '_blank');
  }
}

// Piccolo grafico a linea del peso dagli ultimi check-in (in ordine
// cronologico, non del "più recente prima" usato per la lista sotto):
// solo un colpo d'occhio, niente assi/etichette elaborate.
function graficoPesoCheckinSvg(checkinsRecenteAPrima){
  const punti = checkinsRecenteAPrima.filter(c=>c.peso!=null).slice(0,8).reverse();
  if(punti.length < 2) return '';
  const pesi = punti.map(c=>c.peso);
  const min = Math.min(...pesi), max = Math.max(...pesi);
  const range = (max - min) || 1;
  const W = 300, H = 64, PAD = 6;
  const coord = (v,i) => {
    const x = punti.length===1 ? W/2 : PAD + (i/(punti.length-1))*(W-PAD*2);
    const y = H - PAD - ((v-min)/range)*(H-PAD*2);
    return [x,y];
  };
  const pts = punti.map((c,i)=>coord(c.peso,i));
  const polyline = pts.map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [ux,uy] = pts[pts.length-1];
  return `<div class="checkin-grafico-box">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <polyline points="${polyline}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="3.5" fill="var(--accent)"/>
    </svg>
    <div class="checkin-grafico-legenda"><span>${punti[0].peso} kg · ${formatDate(punti[0].data)}</span><span>${punti[punti.length-1].peso} kg · ${formatDate(punti[punti.length-1].data)}</span></div>
  </div>`;
}
async function impostaCheckinCliente(idRapporto, patch){
  const { error } = await sb.from('rapporti_pt').update(patch).eq('id', idRapporto);
  if(error){ toast("Non riuscito: " + error.message); return; }
  Object.assign(_clienteAperto.rapporto, patch);
  const r2 = _rapporti.find(x=>x.id===idRapporto);
  if(r2) Object.assign(r2, patch);
  await renderDettaglioPT('checkin');
}

// ---------- modificare scheda o dieta di un cliente ----------
// Il cliente non lo vedo mai "dentro al mio account": lavoro su una copia
// isolata dei suoi dati (_clienteBuffer). Il mio profilo, in memoria e sul
// telefono, non viene mai toccato — vedi activeProfile()/save() più sopra.

// Se sto costruendo la scheda di un cliente e uso un MIO esercizio
// personale, lo aggiungo anche ai suoi esercizi personali: così lo ritrova
// già pronto (muscoli, tipo, eventuale video) anche lui, senza doverlo
// ricreare da zero.
function propagaEserciziPersonalizzatiPT(giorni){
  if(!modalitaPT) return;
  const pt = loggedInProfile();
  if(!pt || !pt.customExercises) return;
  const cliente = _clienteBuffer;
  if(!cliente) return;
  if(!cliente.customExercises) cliente.customExercises = {};
  let aggiunti = 0;
  (giorni||[]).forEach(g=>{
    (g.exercises||[]).forEach(ex=>{
      const chiave = (ex.name||'').trim().toLowerCase();
      if(!chiave) return;
      if(pt.customExercises[chiave] && !cliente.customExercises[chiave]){
        cliente.customExercises[chiave] = JSON.parse(JSON.stringify(pt.customExercises[chiave]));
        aggiunti++;
      }
    });
  });
}

// Fotografia di partenza dei dati del cliente su cui il PT lavorerà
// (_clienteBuffer): usata dai tre punti di ingresso qui sotto
// (editor scheda/dieta inline, modificaComePT). Registra anche
// aggiornato_il letto in questo momento — salvaModifichePT() lo confronta
// con quello vero sul server prima di scrivere, per accorgersi se il
// cliente ha salvato qualcosa nel frattempo (vedi lì).
function preparaClienteBuffer(p){
  const buffer = JSON.parse(JSON.stringify(p.dati || {}));
  buffer.id = p.id;
  buffer.name = nomeDi(p);
  buffer.approvato = true;
  if(!buffer.programs || !buffer.programs.length) buffer.programs = [blankProgram()];
  if(!buffer.activeProgramId) buffer.activeProgramId = buffer.programs[buffer.programs.length-1].id;
  if(!buffer.customExercises) buffer.customExercises = {};
  Object.keys(buffer.customExercises).forEach(name=>{
    if(Array.isArray(buffer.customExercises[name])) buffer.customExercises[name] = {muscles: buffer.customExercises[name], video:''};
  });
  if(!buffer.measurements) buffer.measurements = [];
  if(!buffer.mealLogs) buffer.mealLogs = [];
  if(!buffer.waterLogs) buffer.waterLogs = [];
  if(!buffer.checkins) buffer.checkins = [];
  if(!buffer.customFoods) buffer.customFoods = {};
  _clienteBufferApertoIl = p.aggiornato_il || null;
  return buffer;
}

// ---------- editor scheda del cliente, DIRETTAMENTE nella sua scheda (non in una
// schermata a parte): sposto il vero editor (stesso identico markup e stessa
// logica di quando lo fai per te — editingDays, dropset, superset, i due tasti
// Aggiorna/Salva come nuova versione) dentro il pannello del cliente, invece di
// duplicarne il codice. Quando esci da questa scheda, torna al suo posto.
function mostraEditorSchedaInlinePT(){
  if(!_clienteAperto) return;
  const p = _clienteAperto.riga;
  _clienteBuffer = preparaClienteBuffer(p);
  _clienteIdInModifica = p.id;
  _modificaPTCosa = 'scheda';
  modalitaPT = true;
  document.body.classList.add('modifica-pt');   // riusa le stesse regole che nascondono backup/ripristina

  const viewWrap = document.getElementById('ptSchedaViewWrap');
  if(viewWrap) viewWrap.style.display = 'none';
  const editor = document.getElementById('programEditBlock');
  const slot = document.getElementById('ptSchedaEditorSlot');
  if(slot) slot.style.display = 'block';
  if(editor && slot && editor.parentElement !== slot) slot.appendChild(editor);
  if(editor) editor.style.display = 'block';
  renderNewProgramForm();   // popola editingDays con la scheda attuale del cliente
}
// Matita ("Modifica scheda") o "+ Nuova scheda" nella vista PT (stessa coppia
// di azioni del lato cliente, vedi #schedaEditBtn/#nuovaSchedaBtn): fissa
// _modoEditorScheda PRIMA di aprire l'editor inline, così l'editor mostra un
// solo bottone di salvataggio invece di entrambi sempre assieme, esattamente
// come già succede per il cliente che modifica la propria scheda.
function apriEditorSchedaPT(modo){
  _modoEditorScheda = modo;
  mostraEditorSchedaInlinePT();
  if(modo === 'nuova'){
    editingDays = [];
    document.getElementById('newProgramName').value = "";
    document.getElementById('newProgramDurata').value = "";
    document.getElementById('newProgramNotePT').value = "";
    renderDayEditors();
  }
}
// ---------- "Copia da scheda esistente" (08/09/2026) ----------
// SOLO dentro "Nuova scheda" del PT (bottone #ptCopiaSchedaBtn, mostrato solo
// lì da aggiornaModalitaEditorScheda in scheda-editor.js). Permessi: il PT
// può copiare solo le proprie schede e quelle di chi segue ATTIVAMENTE in
// questo momento — mai da _rapporti/_clienteAperto già in cache. Sia
// l'elenco (qui) sia la copia vera e propria (copiaSchedaSelezionata) fanno
// SEMPRE una lettura fresca da Supabase, così un rapporto terminato nel
// frattempo (es. il PT smette di seguire Franco mentre l'elenco è ancora
// aperto) non lascia comunque copiare le sue schede.
async function apriCopiaSchedaOverlay(){
  if(!modalitaPT || _modificaPTCosa !== 'scheda' || _modoEditorScheda !== 'nuova') return;
  const overlay = document.getElementById('ptCopiaSchedaOverlay');
  const box = document.getElementById('ptCopiaSchedaLista');
  overlay.classList.add('show');
  box.innerHTML = '<div class="empty">Carico le schede disponibili…</div>';

  const mieProgrammi = ((loggedInProfile() || {}).programs || []).filter(p=>giorniCompilati(p.days));

  // Fresca ad ogni apertura: mai fidarsi di un elenco rapporti caricato in
  // precedenza (potrebbe non riflettere più un rapporto appena terminato).
  await caricaRapporti();
  const attivi = _rapporti.filter(r => r.pt_id === utenteOnline.id && r.stato === 'attivo');
  const clientiConProgrammi = (await Promise.all(attivi.map(async r=>{
    const cliente = await leggiProfilo(r.cliente_id);
    if(!cliente) return null;
    const programmi = ((cliente.dati || {}).programs || []).filter(p=>giorniCompilati(p.days));
    return programmi.length ? { cliente, programmi } : null;
  }))).filter(Boolean);

  const rigaProgramma = (p, ownerId, ownerNome) => {
    const nEx = (p.days||[]).reduce((n,g)=>n+(g.exercises||[]).length, 0);
    return `<button type="button" class="pt-copia-riga" data-owner="${escapeAttr(ownerId)}" data-programma="${escapeAttr(p.id)}">
        <div class="pname">${escapeAttr(p.name)}${p.archivedAt ? ' <span class="hint">(archiviata)</span>' : ''}</div>
        <div class="hint">${(p.days||[]).length} giorni · ${nEx} esercizi${ownerNome ? ' · ' + escapeAttr(ownerNome) : ''}</div>
      </button>`;
  };
  const sezione = (titolo, righe) => righe.length ? `<div class="pt-copia-sezione"><h4>${titolo}</h4>${righe.join('')}</div>` : '';

  const righeMie = mieProgrammi.map(p=>rigaProgramma(p, 'me', null));
  const righeClienti = clientiConProgrammi.flatMap(c=>c.programmi.map(p=>rigaProgramma(p, c.cliente.id, nomeDi(c.cliente))));

  if(righeMie.length === 0 && righeClienti.length === 0){
    box.innerHTML = '<div class="empty">Non hai ancora nessuna scheda compilata da copiare, né tua né di chi segui.</div>';
    return;
  }
  box.innerHTML = sezione('Le tue schede', righeMie) + sezione('Schede dei tuoi clienti', righeClienti);
  box.querySelectorAll('[data-programma]').forEach(btn=>{
    btn.addEventListener('click', ()=>copiaSchedaSelezionata(btn.dataset.owner, btn.dataset.programma));
  });
}
// Ricontrolla i permessi DI NUOVO al momento della copia (non solo quando si
// è aperto l'elenco poco prima): se il rapporto è stato terminato nel
// frattempo, la copia viene rifiutata e l'elenco si aggiorna da capo.
async function copiaSchedaSelezionata(ownerId, programmaId){
  if(!modalitaPT || _modificaPTCosa !== 'scheda' || _modoEditorScheda !== 'nuova') return;
  let programmi, nomeOwner = null;
  if(ownerId === 'me'){
    programmi = (loggedInProfile() || {}).programs || [];
  } else {
    const { data: rapportoFresco } = await sb.from('rapporti_pt')
      .select('stato').eq('pt_id', utenteOnline.id).eq('cliente_id', ownerId).eq('stato', 'attivo').maybeSingle();
    if(!rapportoFresco){
      toast("Non segui più questa persona: non puoi più copiare le sue schede.");
      apriCopiaSchedaOverlay();
      return;
    }
    const cliente = await leggiProfilo(ownerId);
    if(!cliente){ toast("Non riesco a leggere questa persona."); return; }
    programmi = (cliente.dati || {}).programs || [];
    nomeOwner = nomeDi(cliente);
  }
  const programma = programmi.find(p=>p.id === programmaId);
  if(!programma){ toast("Questa scheda non è più disponibile."); apriCopiaSchedaOverlay(); return; }

  // Copia indipendente: clone profondo, mai lo stesso oggetto/riferimento
  // della scheda originale — modificare l'una non deve mai toccare l'altra.
  editingDays = JSON.parse(JSON.stringify(programma.days || []));
  document.getElementById('newProgramName').value = `Copia di ${programma.name}`;
  document.getElementById('newProgramDurata').value = programma.durataSettimane || "";
  renderDayEditors();
  document.getElementById('ptCopiaSchedaOverlay').classList.remove('show');
  toast(`Scheda copiata${nomeOwner ? ' da ' + nomeOwner : ''} ✓ — modificala e assegnala`);
}
document.getElementById('ptCopiaSchedaBtn').addEventListener('click', apriCopiaSchedaOverlay);
document.getElementById('ptCopiaSchedaChiudi').addEventListener('click', ()=>
  document.getElementById('ptCopiaSchedaOverlay').classList.remove('show'));
document.getElementById('ptCopiaSchedaOverlay').addEventListener('click', e=>{
  if(e.target.id === 'ptCopiaSchedaOverlay') e.currentTarget.classList.remove('show');
});

// Freccia indietro / salvataggio riusciti nell'editor inline: chiude davvero
// l'editor (salva + rimette il markup al suo posto nel lato cliente) e
// ridisegna la vista PT in modalità "Vedi", come fa il pencil/back del
// cliente sulla propria scheda. Richiamate dai bottoni condivisi in
// scheda-editor.js/dieta, guardate lì da modalitaPT+_modificaPTCosa.
async function tornaVistaSchedaPT(){
  if(!modalitaPT || _modificaPTCosa !== 'scheda') return;
  await chiudiEditorSchedaInlinePT();
  await renderDettaglioPT('scheda');
}
async function tornaVistaDietaPT(){
  if(!modalitaPT || _modificaPTCosa !== 'dieta') return;
  await chiudiEditorDietaInlinePT();
  await renderDettaglioPT('dieta');
}
// Riporta l'editor al suo posto originale (dentro Scheda, per quando lo usi tu)
// e salva subito eventuali modifiche in sospeso prima di uscire dalla pagina
// del cliente — così non si perde nulla passando ad un altro tab.
async function chiudiEditorSchedaInlinePT(){
  if(!modalitaPT || _modificaPTCosa !== 'scheda') return;
  clearTimeout(_ptSalvataggioTimer);
  await salvaModifichePT();
  if(_clienteAperto) _clienteAperto.riga.dati = _clienteBuffer;
  const editor = document.getElementById('programEditBlock');
  const anchor = document.getElementById('programEditBlockAnchor');
  if(editor && anchor) anchor.parentElement.insertBefore(editor, anchor.nextSibling);
  if(editor) editor.style.display = 'none';
  document.body.classList.remove('modifica-pt');
  modalitaPT = false;
  _clienteBuffer = null;
  _clienteIdInModifica = null;
  _modificaPTCosa = null;
}

// Stesso meccanismo di mostraEditorSchedaInlinePT/chiudiEditorSchedaInlinePT,
// ma per la dieta: sposto dietPlanEditBlock dentro la pagina del cliente invece
// di duplicarne markup e logica.
function mostraEditorDietaInlinePT(){
  if(!_clienteAperto) return;
  const p = _clienteAperto.riga;
  _clienteBuffer = preparaClienteBuffer(p);
  _clienteIdInModifica = p.id;
  _modificaPTCosa = 'dieta';
  modalitaPT = true;
  document.body.classList.add('modifica-pt');

  const viewWrap = document.getElementById('ptDietaViewWrap');
  if(viewWrap) viewWrap.style.display = 'none';
  const editor = document.getElementById('dietPlanEditBlock');
  const slot = document.getElementById('ptDietaEditorSlot');
  if(slot) slot.style.display = 'block';
  if(editor && slot && editor.parentElement !== slot) slot.appendChild(editor);
  if(editor) editor.style.display = 'block';
  renderDietEditForm();
}
async function chiudiEditorDietaInlinePT(){
  if(!modalitaPT || _modificaPTCosa !== 'dieta') return;
  clearTimeout(_ptSalvataggioTimer);
  await salvaModifichePT();
  if(_clienteAperto) _clienteAperto.riga.dati = _clienteBuffer;
  const editor = document.getElementById('dietPlanEditBlock');
  const anchor = document.getElementById('dietPlanEditBlockAnchor');
  if(editor && anchor) anchor.parentElement.insertBefore(editor, anchor);
  if(editor) editor.style.display = 'none';
  document.body.classList.remove('modifica-pt');
  modalitaPT = false;
  _clienteBuffer = null;
  _clienteIdInModifica = null;
  _modificaPTCosa = null;
}

function modificaComePT(cosa){
  if(!_clienteAperto) return;
  const p = _clienteAperto.riga;
  _clienteBuffer = preparaClienteBuffer(p);
  _clienteIdInModifica = p.id;
  _modificaPTCosa = cosa;
  modalitaPT = true;
  document.body.classList.add('modifica-pt');
  document.getElementById('areaPT').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
  document.getElementById('bannerPT').style.display = 'flex';
  document.getElementById('bannerPTNome').textContent = `Stai modificando: ${nomeDi(p)}`;
  renderAll();
  const tab = document.querySelector(cosa === 'dieta' ? '.tab-btn[data-tab="diet"]' : '.tab-btn[data-tab="program"]');
  if(tab) tab.click();
  const segBtn = document.querySelector(cosa === 'dieta' ? '.seg-btn[data-segd="edit"]' : '.seg-btn[data-seg="edit"]');
  if(segBtn) segBtn.click();
  toast(`Stai lavorando sulla ${cosa} di ${nomeDi(p)}`);
}

// salva subito la scheda/dieta del cliente sul SUO account online — mai sul mio telefono
async function salvaModifichePT(){
  if(!modalitaPT || !_clienteBuffer || !_clienteIdInModifica) return true;
  // Rete di sicurezza: qualunque cosa causi un id sbagliato a monte, questo
  // salvataggio non deve MAI poter scrivere sul profilo del PT stesso invece
  // che su quello del cliente — meglio un salvataggio fallito con un avviso
  // che una scheda che finisce sull'account sbagliato.
  if(!utenteOnline || _clienteIdInModifica === utenteOnline.id){
    console.error('Blocco di sicurezza: salvaModifichePT stava per scrivere sul profilo del PT stesso.', {_clienteIdInModifica, utenteOnline});
    toast("Errore di sicurezza: salvataggio bloccato. Riprova, e se persiste dimmelo.");
    return false;
  }
  if(!sb){ toast("Serve la connessione per salvare sul suo account."); return false; }

  // Scrittura condizionata: aggiorno solo se aggiornato_il è ancora quello
  // che avevo letto quando ho aperto l'editor (.eq in più). Il caso normale
  // (nessuno ha toccato il profilo nel frattempo) costa un solo giro di
  // rete, uguale a prima. Se invece qualcuno ha salvato — tipicamente il
  // cliente stesso, un allenamento o un check-in — la condizione non trova
  // corrispondenza: PostgREST non scrive nulla e torna un array vuoto,
  // senza errore. È il segnale per rileggere, riapplicare sopra SOLO
  // scheda/dieta (mai storico/misure/check-in, che sono suoi) e riprovare.
  const nuovoAggiornatoIl = new Date().toISOString();
  let query = sb.from('profili')
    .update({ dati: _clienteBuffer, aggiornato_il: nuovoAggiornatoIl })
    .eq('id', _clienteIdInModifica);
  if(_clienteBufferApertoIl) query = query.eq('aggiornato_il', _clienteBufferApertoIl);
  const { data, error } = await query.select('id');
  if(error){ console.error(error); toast("Non riuscito a salvare: " + error.message); return false; }

  if(data && data.length > 0){
    _clienteBufferApertoIl = nuovoAggiornatoIl;
    if(_clienteAperto) _clienteAperto.riga.aggiornato_il = nuovoAggiornatoIl;
    return true;
  }

  const { data: fresco, error: erroreLettura } = await sb.from('profili')
    .select('dati,aggiornato_il').eq('id', _clienteIdInModifica).maybeSingle();
  if(erroreLettura || !fresco){
    console.error(erroreLettura);
    toast("Non riuscito a salvare: il cliente ha aggiornato i suoi dati nel frattempo, riprova.");
    return false;
  }
  const datiUniti = Object.assign({}, fresco.dati, {
    programs: _clienteBuffer.programs,
    activeProgramId: _clienteBuffer.activeProgramId
  });
  const nuovoAggiornatoIl2 = new Date().toISOString();
  const { error: erroreScrittura } = await sb.from('profili')
    .update({ dati: datiUniti, aggiornato_il: nuovoAggiornatoIl2 })
    .eq('id', _clienteIdInModifica);
  if(erroreScrittura){ console.error(erroreScrittura); toast("Non riuscito a salvare: " + erroreScrittura.message); return false; }
  _clienteBuffer = datiUniti;
  _clienteBufferApertoIl = nuovoAggiornatoIl2;
  if(_clienteAperto) _clienteAperto.riga.aggiornato_il = nuovoAggiornatoIl2;
  toast("Il cliente ha aggiornato i suoi dati nel frattempo: ho salvato la tua modifica senza toccare il suo storico.");
  return true;
}
function programmaSalvataggioPT(){
  clearTimeout(_ptSalvataggioTimer);
  _ptSalvataggioTimer = setTimeout(salvaModifichePT, 1200);   // accorpa le modifiche ravvicinate, come per il mio account
}

async function tornaDaModificaPT(){
  if(!modalitaPT || !_clienteAperto) return;
  clearTimeout(_ptSalvataggioTimer);
  const ok = await salvaModifichePT();
  if(!ok) return;   // resto dentro finché non riesco a salvare: niente si perde
  if(_clienteAperto) _clienteAperto.riga.dati = _clienteBuffer;
  if(_clienteAperto.rapporto) avvisaInChat(_clienteAperto.rapporto.id, `Ho aggiornato la tua ${_modificaPTCosa === 'dieta' ? 'dieta' : 'scheda'} 📋`);
  modalitaPT = false;
  _clienteBuffer = null;
  _clienteIdInModifica = null;
  _modificaPTCosa = null;
  document.body.classList.remove('modifica-pt');
  document.getElementById('bannerPT').style.display = 'none';
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('areaPT').style.display = 'block';
  document.getElementById('ptElenco').style.display = 'none';
  document.getElementById('ptDettaglio').style.display = 'block';
  await renderDettaglioPT(document.querySelector('.pt-tab.active').dataset.pttab);
  toast("Modifiche salvate ✓");
}

