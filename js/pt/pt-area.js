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
function apriAreaPT(){
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
  document.getElementById('ptHeroStats').innerHTML = `
    <div class="pth-chip"><b>${attivi.length}</b><span>Seguiti</span></div>
    <div class="pth-chip${richieste.length ? ' accent' : ''}"><b>${richieste.length}</b><span>Richieste</span></div>
    <div class="pth-chip"><b>${attiviQuestaSettimana}</b><span>Attivi questa settimana</span></div>`;

  // ---- vista d'insieme: "cose da guardare oggi" come striscia di alert
  // colorati per tipo (non più una card con elenco puntato) ----
  const boxOggi = document.getElementById('ptOggi');
  if(totaleOggi === 0){
    boxOggi.innerHTML = '<div class="pt-empty-banner">Tutto in ordine: nessuna richiesta in sospeso, nessuno fermo da troppo e nessun piano scaduto ✓</div>';
  } else {
    const alertCard = (tipo, label, nome, meta, attrs)=>`<button type="button" class="pt-alert-card ${tipo}" ${attrs}>
        <div class="head"><span class="dot"></span><span class="lab">${label}</span></div>
        <div class="nome">${escapeAttr(nome)}</div>
        <div class="desc">${escapeAttr(meta)}</div>
        <div class="link">Apri →</div>
      </button>`;
    const cards = [];
    if(richieste.length){
      cards.push(`<button type="button" class="pt-alert-card accent" data-vai-richieste="1">
          <div class="head"><span class="dot"></span><span class="lab">RICHIESTE</span></div>
          <div class="nome">${richieste.length}</div>
          <div class="desc">${richieste.length===1?'richiesta da accettare o rifiutare':'richieste da accettare o rifiutare'}</div>
          <div class="link">Vedi sotto ↓</div>
        </button>`);
    }
    fermi.forEach(v=>cards.push(alertCard('warn', 'FERMO', nomeDi(v.p),
      v.s.giorniFermo===null ? 'non si è ancora allenato' : `fermo da ${v.s.giorniFermo} giorni`,
      `data-apri-oggi="${v.r.cliente_id}"`)));
    scaduti.forEach(v=>cards.push(alertCard('danger', 'SCADUTO', nomeDi(v.p),
      `scheda "${v.s.scheda.name}" scaduta il ${formatDate(v.s.scheda.scadenza)}`,
      `data-apri-oggi="${v.r.cliente_id}"`)));
    boxOggi.innerHTML = `<div class="pt-scroll-row">${cards.join('')}</div>`;
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

  function schedaCard(r, p, s){
    const d = p.dati || {};
    const allen = (d.logs||[]).filter(l=>l.status==='registrato').length;
    const permessi = [r.puo_scheda ? 'scheda' : null, r.puo_dieta ? 'dieta' : null].filter(Boolean);
    const permLabel = permessi.length ? 'Modifichi ' + permessi.join(' e ') : 'Sola lettura';
    const fr = freshnessDi(s);
    return `<div class="pt-client-wrap">
        <button type="button" class="pt-client-card" data-apri="${r.cliente_id}">
          <div class="pt-avatar">${avatarContentHtml(nomeDi(p), d.avatarUrl)}</div>
          <div><div class="nome">${escapeAttr(nomeDi(p))}</div><div class="meta">${allen} allenamenti</div></div>
          <div class="pt-fresh"><i style="width:${fr.pct}%; background:${fr.colore};"></i></div>
          <span class="pt-perm-chip">${permLabel}</span>
        </button>
        <button type="button" class="pt-termina-link" data-chiudi="${r.id}">Termina rapporto</button>
      </div>`;
  }

  function spotlightCard(r, p, s){
    const d = p.dati || {};
    const fr = freshnessDi(s);
    const motivi = [];
    if(s.fermoDaTroppo) motivi.push(s.giorniFermo===null ? 'non si è ancora allenato' : `fermo da ${s.giorniFermo} giorni`);
    if(s.scadenzaPassata) motivi.push('scheda scaduta');
    return `<div class="pt-client-wrap spotlight">
        <button type="button" class="pt-spotlight" data-apri="${r.cliente_id}">
          <div class="pt-avatar pt-avatar-lg">${avatarContentHtml(nomeDi(p), d.avatarUrl)}</div>
          <div class="info">
            <div class="nome">${escapeAttr(nomeDi(p))}</div>
            <div class="status">${escapeAttr(motivi.join(' · '))}</div>
            <div class="pt-fresh"><i style="width:${fr.pct}%; background:${fr.colore};"></i></div>
          </div>
          <span class="pt-spotlight-btn">Apri</span>
        </button>
        <button type="button" class="pt-termina-link" data-chiudi="${r.id}">Termina rapporto</button>
      </div>`;
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
  renderDettaglioPT('riepilogo');
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
    renderDettaglioPT(t.dataset.pttab);
  } finally {
    _cambiandoTabPT = false;
    tabs.style.opacity = '';
    tabs.style.pointerEvents = '';
  }
}));

function renderDettaglioPT(sezione){
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
    box.innerHTML = `
      <div class="card">
        <h3>Scheda${puo ? '' : ' (sola lettura)'}</h3>
        ${puo ? '<p class="hint">Modifica direttamente qui sotto: le modifiche arrivano subito sul suo telefono.</p>'
              : '<p class="hint">Per modificarla serve che la persona ti dia il permesso dalla sua scheda.</p>'}
        ${!prog ? '<div class="empty">Nessuna scheda impostata.</div>' : `
          <div class="pt-scheda-ro"><b>${prog.name}</b> <span class="hint">dal ${formatDate(prog.createdAt)}${prog.scadenza ? ' · scadenza ' + formatDate(prog.scadenza) + (giorniDaOggi(prog.scadenza) > 0 ? ' (scaduta)' : '') : ''}</span></div>
          ${(prog.days||[]).map(g=>`
            <div class="pt-scheda-ro">
              <b>${g.key} · ${g.name}</b> <span class="hint">${g.weekday || 'senza giorno fisso'}</span>
              ${(g.exercises||[]).map(e=>`<div class="hint" style="margin-top:4px;">${e.name} — ${descriviTargetSerie(e)}${etichettaTecnica(e,g)}</div>${e.note?`<div class="exercise-note" style="margin:2px 0 4px 10px;">📌 ${escapeAttr(e.note)}</div>`:''}`).join('')}
            </div>`).join('')}
        `}
      </div>
      ${puo ? '<div id="ptSchedaEditorSlot"></div>' : ''}`;
    if(puo) mostraEditorSchedaInlinePT();
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
    box.innerHTML = `
      <div class="card">
        <h3>Dieta${puo ? '' : ' (sola lettura)'}</h3>
        ${puo ? '<p class="hint">Modifica direttamente qui sotto: le modifiche arrivano subito sul suo telefono.</p>'
              : '<p class="hint">Per modificarla serve che la persona ti dia il permesso.</p>'}
        ${righeGiorni ? righeGiorni : '<div class="empty">Nessun piano alimentare impostato.</div>'}
      </div>
      ${puo ? '<div id="ptDietaEditorSlot"></div>' : ''}`;
    if(puo) mostraEditorDietaInlinePT();
    segnaVistaPT('dieta');
  }
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

// ---------- editor scheda del cliente, DIRETTAMENTE nella sua scheda (non in una
// schermata a parte): sposto il vero editor (stesso identico markup e stessa
// logica di quando lo fai per te — editingDays, dropset, superset, i due tasti
// Aggiorna/Salva come nuova versione) dentro il pannello del cliente, invece di
// duplicarne il codice. Quando esci da questa scheda, torna al suo posto.
function mostraEditorSchedaInlinePT(){
  if(!_clienteAperto) return;
  const p = _clienteAperto.riga;
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
  if(!buffer.customFoods) buffer.customFoods = {};

  _clienteBuffer = buffer;
  _clienteIdInModifica = p.id;
  _modificaPTCosa = 'scheda';
  modalitaPT = true;
  document.body.classList.add('modifica-pt');   // riusa le stesse regole che nascondono backup/ripristina

  const editor = document.getElementById('programEditBlock');
  const slot = document.getElementById('ptSchedaEditorSlot');
  if(editor && slot && editor.parentElement !== slot) slot.appendChild(editor);
  if(editor) editor.style.display = 'block';
  renderNewProgramForm();   // popola editingDays con la scheda attuale del cliente
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
  if(!buffer.customFoods) buffer.customFoods = {};

  _clienteBuffer = buffer;
  _clienteIdInModifica = p.id;
  _modificaPTCosa = 'dieta';
  modalitaPT = true;
  document.body.classList.add('modifica-pt');

  const editor = document.getElementById('dietPlanEditBlock');
  const slot = document.getElementById('ptDietaEditorSlot');
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
  const buffer = JSON.parse(JSON.stringify(p.dati || {}));
  buffer.id = p.id;
  buffer.name = nomeDi(p);
  buffer.approvato = true;
  if(!buffer.programs || !buffer.programs.length) buffer.programs = [blankProgram()];
  if(!buffer.activeProgramId) buffer.activeProgramId = buffer.programs[buffer.programs.length-1].id;
  if(!buffer.customExercises) buffer.customExercises = {};
  // vecchio formato (solo array di muscoli, senza video/tipo): lo aggiorno come fa load() per me
  Object.keys(buffer.customExercises).forEach(name=>{
    if(Array.isArray(buffer.customExercises[name])) buffer.customExercises[name] = {muscles: buffer.customExercises[name], video:''};
  });
  if(!buffer.measurements) buffer.measurements = [];
  if(!buffer.mealLogs) buffer.mealLogs = [];
  if(!buffer.waterLogs) buffer.waterLogs = [];
  if(!buffer.customFoods) buffer.customFoods = {};

  _clienteBuffer = buffer;
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
  const { error } = await sb.from('profili')
    .update({ dati: _clienteBuffer, aggiornato_il: new Date().toISOString() })
    .eq('id', _clienteIdInModifica);
  if(error){ console.error(error); toast("Non riuscito a salvare: " + error.message); return false; }
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
  renderDettaglioPT(document.querySelector('.pt-tab.active').dataset.pttab);
  toast("Modifiche salvate ✓");
}

