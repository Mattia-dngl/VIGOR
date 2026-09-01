// ============================================================
// MESSAGGI — elenco chat (stile WhatsApp) e creazione di nuove chat.
// Aggiunto 01/09/2026 insieme all'icona chat nell'header di Account.
//
// Due tipi di conversazione, unificati in un solo elenco:
// - "rapporto": la chat PT↔cliente di sempre (rapporti_pt/apriMessaggi
//   in js/pt/pt-collegamento.js) — invariata, solo elencata qui insieme al resto.
// - "chat": le nuove chat libere multi-partecipante (tabelle chat_gruppi/
//   chat_partecipanti, RPC crea_chat/utenti_selezionabili_per_chat sul
//   database). In futuro l'elenco di utenti selezionabili sarà limitato ai
//   soci della propria palestra (nota mostrata già oggi in #nuovaChatOverlay).
//
// apriMessaggi()/caricaMessaggi()/ascoltaMessaggi() restano quelle di
// pt-collegamento.js: generalizzate lì per accettare sia un rapporto_id sia
// un chat_id (parametro "tipo").
// ============================================================
let _elencoChatCache = [];
let _nuovaChatUtenti = [];
let _nuovaChatVisibili = [];
let _nuovaChatSelezionati = new Set();

function formatOraChat(iso){
  if(!iso) return '';
  const d = new Date(iso);
  const oggi = new Date();
  const stessogiorno = d.toDateString() === oggi.toDateString();
  if(stessogiorno) return d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  const ieri = new Date(oggi); ieri.setDate(oggi.getDate()-1);
  if(d.toDateString() === ieri.toDateString()) return 'Ieri';
  return d.toLocaleDateString('it-IT', {day:'2-digit', month:'2-digit'});
}

async function apriMessaggiHome(){
  document.getElementById('messaggiHomeOverlay').classList.add('show');
  document.getElementById('messaggiHomeCerca').value = '';
  const box = document.getElementById('elencoChatCorpo');
  if(!utenteOnline){
    box.innerHTML = '<p class="hint" style="text-align:center; margin-top:20px;">Disponibile solo con un account online.</p>';
    return;
  }
  box.innerHTML = '<p class="hint" style="text-align:center; margin-top:20px;">Carico le chat…</p>';
  _elencoChatCache = await caricaElencoChat();
  renderElencoChat(_elencoChatCache);
}
function chiudiMessaggiHome(){
  document.getElementById('messaggiHomeOverlay').classList.remove('show');
  aggiornaPuntinoMessaggi();
}
document.getElementById('messaggiHomeCerca').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  const filtrati = q ? _elencoChatCache.filter(c=>c.titolo.toLowerCase().includes(q)) : _elencoChatCache;
  renderElencoChat(filtrati);
});

// Puntino non letti sull'icona Messaggi in Account (header): riusa lo stesso
// elenco "chi mi riguarda" della campanella Home (idRapportiRilevanti, in
// home.js) + le chat libere di cui faccio parte.
async function aggiornaPuntinoMessaggi(){
  const dot = document.getElementById('acctMessaggiPuntino');
  if(!dot) return;
  if(!sb || !utenteOnline){ dot.style.display = 'none'; return; }
  try{
    let nonLetti = 0;
    const idRapporti = (typeof idRapportiRilevanti === 'function') ? idRapportiRilevanti() : [];
    if(idRapporti.length){
      const { count } = await sb.from('messaggi').select('id', {count:'exact', head:true})
        .in('rapporto_id', idRapporti).eq('letto', false).neq('mittente_id', utenteOnline.id);
      nonLetti += count || 0;
    }
    const { data: mieChat } = await sb.from('chat_partecipanti').select('chat_id').eq('utente_id', utenteOnline.id);
    const idChat = [...new Set((mieChat||[]).map(x=>x.chat_id))];
    if(idChat.length){
      const { count } = await sb.from('messaggi').select('id', {count:'exact', head:true})
        .in('chat_id', idChat).eq('letto', false).neq('mittente_id', utenteOnline.id);
      nonLetti += count || 0;
    }
    dot.style.display = nonLetti > 0 ? 'block' : 'none';
  }catch(e){ console.error(e); }
}

// Costruisce l'elenco unificato: conversazioni PT↔cliente (rapporti attivi)
// + chat libere di cui faccio parte, ciascuna con l'ultimo messaggio e il
// conteggio dei non letti. Query dirette per conversazione (niente RPC
// dedicata): coerente con lo stile già usato da renderNotifiche() in
// home.js, e per ora il numero di conversazioni per persona è piccolo.
async function caricaElencoChat(){
  if(!sb || !utenteOnline) return [];
  const elenco = [];

  await caricaRapporti();
  const attivi = (_rapporti||[]).filter(r=>r.stato==='attivo');
  if(attivi.length){
    const altriIds = attivi.map(r=> r.cliente_id===utenteOnline.id ? r.pt_id : r.cliente_id);
    const { data: profiliAltri } = await sb.from('profili').select('id,nome,nome_pubblico').in('id', altriIds);
    for(const r of attivi){
      const altroId = r.cliente_id===utenteOnline.id ? r.pt_id : r.cliente_id;
      const profilo = (profiliAltri||[]).find(p=>p.id===altroId);
      if(!profilo) continue;
      const { data: msgs } = await sb.from('messaggi').select('*')
        .eq('rapporto_id', r.id).order('creato_il', {ascending:false}).limit(1);
      const ultimo = (msgs||[])[0];
      const { count } = await sb.from('messaggi').select('id', {count:'exact', head:true})
        .eq('rapporto_id', r.id).eq('letto', false).neq('mittente_id', utenteOnline.id);
      elenco.push({
        tipo: 'rapporto', id: r.id, altroId, titolo: nomeDi(profilo), gruppo: false,
        ultimoTesto: ultimo ? ultimo.testo : null,
        ultimoQuando: ultimo ? ultimo.creato_il : r.accettato_il,
        nonLetti: count || 0
      });
    }
  }

  const { data: mieChat } = await sb.from('chat_partecipanti').select('chat_id').eq('utente_id', utenteOnline.id);
  const idChat = [...new Set((mieChat||[]).map(x=>x.chat_id))];
  if(idChat.length){
    const { data: chatRighe } = await sb.from('chat_gruppi').select('*').in('id', idChat);
    const { data: partecipantiRighe } = await sb.from('chat_partecipanti').select('chat_id,utente_id').in('chat_id', idChat);
    const altriIdsChat = [...new Set((partecipantiRighe||[]).filter(p=>p.utente_id!==utenteOnline.id).map(p=>p.utente_id))];
    const { data: profiliChat } = altriIdsChat.length
      ? await sb.from('profili').select('id,nome,nome_pubblico').in('id', altriIdsChat)
      : { data: [] };
    for(const c of (chatRighe||[])){
      const altriQuesta = (partecipantiRighe||[]).filter(p=>p.chat_id===c.id && p.utente_id!==utenteOnline.id).map(p=>p.utente_id);
      const nomiAltri = altriQuesta.map(id=>nomeDi((profiliChat||[]).find(p=>p.id===id))).filter(Boolean);
      const titolo = c.titolo || nomiAltri.join(', ') || 'Chat';
      const { data: msgs } = await sb.from('messaggi').select('*')
        .eq('chat_id', c.id).order('creato_il', {ascending:false}).limit(1);
      const ultimo = (msgs||[])[0];
      const { count } = await sb.from('messaggi').select('id', {count:'exact', head:true})
        .eq('chat_id', c.id).eq('letto', false).neq('mittente_id', utenteOnline.id);
      elenco.push({
        tipo: 'chat', id: c.id, altroId: altriQuesta[0] || null, titolo, gruppo: altriQuesta.length > 1,
        ultimoTesto: ultimo ? ultimo.testo : null,
        ultimoQuando: ultimo ? ultimo.creato_il : c.creato_il,
        nonLetti: count || 0
      });
    }
  }

  elenco.sort((a,b)=> new Date(b.ultimoQuando||0) - new Date(a.ultimoQuando||0));
  return elenco;
}

const ICONA_GRUPPO_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 13.2c2.6.5 4.5 2.4 4.5 4.8"/></svg>';

function renderElencoChat(elenco){
  const box = document.getElementById('elencoChatCorpo');
  if(elenco.length === 0){
    box.innerHTML = '<p class="hint" style="text-align:center; margin-top:24px;">Nessuna chat ancora. Tocca "+" in alto per iniziarne una.</p>';
    return;
  }
  box.innerHTML = elenco.map((c,i)=>`
    <button type="button" class="chat-riga" data-i="${i}">
      <div class="chat-riga-avatar${c.gruppo ? ' gruppo' : ''}">${c.gruppo ? ICONA_GRUPPO_SVG : inizialiDi(c.titolo)}</div>
      <div class="chat-riga-corpo">
        <div class="chat-riga-top">
          <div class="chat-riga-nome">${escapeAttr(c.titolo)}</div>
          <div class="chat-riga-ora${c.nonLetti ? ' non-letto' : ''}">${formatOraChat(c.ultimoQuando)}</div>
        </div>
        <div class="chat-riga-bottom">
          <div class="chat-riga-anteprima">${escapeAttr(c.ultimoTesto || 'Nessun messaggio ancora')}</div>
          ${c.nonLetti ? `<span class="chat-riga-badge">${c.nonLetti}</span>` : ''}
        </div>
      </div>
    </button>`).join('');
  box.querySelectorAll('[data-i]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const c = elenco[parseInt(el.dataset.i)];
      chiudiMessaggiHome();
      apriMessaggi(c.id, c.altroId, c.titolo, c.tipo);
    });
  });
}

document.getElementById('messaggiHomeChiudiBtn').addEventListener('click', chiudiMessaggiHome);
document.getElementById('messaggiHomeNuovaBtn').addEventListener('click', ()=>apriNuovaChat());

// ---------- Nuova chat: ricerca utenti e selezione partecipanti ----------
async function apriNuovaChat(){
  document.getElementById('nuovaChatOverlay').classList.add('show');
  document.getElementById('nuovaChatCerca').value = '';
  _nuovaChatSelezionati = new Set();
  renderNuovaChatChips();
  aggiornaBottoneCreaChat();
  const box = document.getElementById('nuovaChatCorpo');
  box.innerHTML = '<p class="hint" style="text-align:center; margin-top:20px;">Carico gli utenti…</p>';
  const { data, error } = await sb.rpc('utenti_selezionabili_per_chat');
  if(error){ box.innerHTML = '<p class="hint" style="text-align:center;">Non riesco a caricare gli utenti.</p>'; return; }
  _nuovaChatUtenti = data || [];
  renderNuovaChatLista(_nuovaChatUtenti);
}
function chiudiNuovaChat(){
  document.getElementById('nuovaChatOverlay').classList.remove('show');
}

function renderNuovaChatLista(utenti){
  _nuovaChatVisibili = utenti;
  const box = document.getElementById('nuovaChatCorpo');
  if(utenti.length === 0){
    box.innerHTML = '<p class="hint" style="text-align:center; margin-top:20px;">Nessun utente trovato.</p>';
    return;
  }
  box.innerHTML = utenti.map(u=>{
    const nome = u.nome_pubblico || u.nome || 'Senza nome';
    const selezionato = _nuovaChatSelezionati.has(u.id);
    return `
    <button type="button" class="nuova-chat-riga${selezionato ? ' selezionato' : ''}" data-id="${u.id}">
      <div class="nuova-chat-avatar">${inizialiDi(nome)}</div>
      <div class="nuova-chat-corpo">
        <div class="nuova-chat-nome">${escapeAttr(nome)}</div>
        <div class="nuova-chat-ruolo">${u.is_pt ? 'Personal trainer' : 'Utente VIGOR'}</div>
      </div>
      <div class="nuova-chat-check${selezionato ? ' on' : ''}">${selezionato ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4L19 6"/></svg>' : ''}</div>
    </button>`;
  }).join('');
  box.querySelectorAll('[data-id]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const id = el.dataset.id;
      if(_nuovaChatSelezionati.has(id)) _nuovaChatSelezionati.delete(id);
      else _nuovaChatSelezionati.add(id);
      renderNuovaChatLista(utenti);
      renderNuovaChatChips();
      aggiornaBottoneCreaChat();
    });
  });
}

// Riga di "chip" con i partecipanti già scelti, sopra l'elenco — toccare la
// x rimuove la persona dalla selezione senza dover ritrovarla nell'elenco.
function renderNuovaChatChips(){
  const wrap = document.getElementById('nuovaChatChips');
  const ids = Array.from(_nuovaChatSelezionati);
  if(ids.length === 0){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  wrap.style.display = 'flex';
  wrap.innerHTML = ids.map(id=>{
    const u = _nuovaChatUtenti.find(x=>x.id===id);
    const nome = u ? (u.nome_pubblico || u.nome || 'Senza nome') : '—';
    return `<button type="button" class="chip" data-id="${id}">${escapeAttr(nome)}
      <span class="chip-x"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>
    </button>`;
  }).join('');
  wrap.querySelectorAll('[data-id]').forEach(el=>{
    el.addEventListener('click', ()=>{
      _nuovaChatSelezionati.delete(el.dataset.id);
      renderNuovaChatLista(_nuovaChatVisibili);
      renderNuovaChatChips();
      aggiornaBottoneCreaChat();
    });
  });
}

function aggiornaBottoneCreaChat(){
  const btn = document.getElementById('creaChatBtn');
  const n = _nuovaChatSelezionati.size;
  btn.disabled = n === 0;
  btn.textContent = n > 0 ? `Crea chat (${n} selezionat${n===1?'o':'i'})` : 'Crea chat';
}

async function creaNuovaChat(){
  if(_nuovaChatSelezionati.size === 0) return;
  const partecipanti = Array.from(_nuovaChatSelezionati);
  const { data: chatId, error } = await sb.rpc('crea_chat', { partecipanti_ids: partecipanti });
  if(error){ toast("Non riuscito: " + error.message); return; }
  const primoAltro = _nuovaChatUtenti.find(u=>u.id === partecipanti[0]);
  const titolo = partecipanti.length === 1
    ? nomeDi(primoAltro)
    : partecipanti.map(id=>nomeDi(_nuovaChatUtenti.find(u=>u.id===id))).join(', ');
  chiudiNuovaChat();
  chiudiMessaggiHome();
  apriMessaggi(chatId, partecipanti[0], titolo, 'chat');
}

document.getElementById('nuovaChatChiudiBtn').addEventListener('click', chiudiNuovaChat);
document.getElementById('creaChatBtn').addEventListener('click', creaNuovaChat);
document.getElementById('nuovaChatCerca').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  const filtrati = q
    ? _nuovaChatUtenti.filter(u=>(u.nome_pubblico||u.nome||'').toLowerCase().includes(q))
    : _nuovaChatUtenti;
  renderNuovaChatLista(filtrati);
});
