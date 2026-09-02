// ============================================================
// PERSONAL TRAINER
// Area separata: chi ha l'appellativo entra da qui e gestisce solo le persone
// che segue. Il cliente decide se lasciargli modificare scheda e dieta, e sia
// cliente sia trainer possono chiudere il rapporto quando vogliono.
// ============================================================
let _rapporti = [];        // rapporti che mi riguardano (come cliente o come trainer)
// Nome del mio PT attivo, messo in cache qui da renderMioPT() (che lo legge in modo
// asincrono da Supabase): la card compatta di Scheda (renderSchedaView, sincrona) lo
// mostra solo se già in cache, senza bloccarsi in attesa della rete — se non c'è ancora,
// semplicemente non mostra la riga "PT" finché renderMioPT() non la ripopola.
let _mioPTNomeCache = null;
let _clienteAperto = null; // cliente che sto guardando nell'area PT

function sonoPT(){ return !!(rigaOnline && rigaOnline.is_pt); }
function nomeDi(riga){ return (riga && (riga.nome_pubblico || riga.nome)) || 'Senza nome'; }

// ---------- resto in ascolto del mio stesso profilo ----------
// Chi gestisce l'app può darti/toglierti l'appellativo di Personal Trainer o bloccarti
// mentre stai usando l'app: senza questo, te ne accorgeresti solo chiudendo e riaprendo.
let _canaleMioProfilo = null;
// ============================================================
// MESSAGGI: un messaggio per volta, in tempo reale. Un "canale" è o un
// rapporto_id (chat PT ↔ cliente, come sempre) o un chat_id (chat libere
// multi-partecipante, nuove — vedi js/account/messaggi.js per come si
// aprono/creano). Le funzioni qui sotto restano le stesse per entrambi,
// distinguendo solo su quale colonna filtrare.
// ============================================================
let _msgRapportoId = null, _msgChatId = null, _msgAltroId = null, _msgAltroNome = '';
let _msgTipo = 'rapporto'; // 'rapporto' | 'chat'
let _messaggi = [];
let _canaleMessaggi = null;

function inizialiDi(nome){
  return (nome||'?').trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
}

function _colonnaCanaleMsg(){ return _msgTipo === 'chat' ? 'chat_id' : 'rapporto_id'; }
function _idCanaleMsgAttivo(){ return _msgTipo === 'chat' ? _msgChatId : _msgRapportoId; }

// tipo: 'rapporto' (default, invariato per tutte le chiamate esistenti) o 'chat'.
async function apriMessaggi(id, altroId, altroNome, tipo){
  if(!sb || !utenteOnline){ toast("Serve la connessione per i messaggi."); return; }
  _msgTipo = tipo === 'chat' ? 'chat' : 'rapporto';
  _msgRapportoId = _msgTipo === 'rapporto' ? id : null;
  _msgChatId = _msgTipo === 'chat' ? id : null;
  _msgAltroId = altroId; _msgAltroNome = altroNome;
  document.getElementById('msgAvatar').textContent = inizialiDi(altroNome);
  document.getElementById('msgNomeAltro').textContent = altroNome;
  document.getElementById('msgCorpo').innerHTML = '<p class="hint" style="text-align:center; margin-top:20px;">Carico i messaggi…</p>';
  document.getElementById('messaggiOverlay').classList.add('show');
  document.getElementById('msgTestoInput').value = '';
  await caricaMessaggi();
  ascoltaMessaggi(id, _msgTipo);
}
function chiudiMessaggi(){
  document.getElementById('messaggiOverlay').classList.remove('show');
  if(_canaleMessaggi){ sb.removeChannel(_canaleMessaggi); _canaleMessaggi = null; }
  _msgRapportoId = null; _msgChatId = null; _msgAltroId = null; _messaggi = []; _msgTipo = 'rapporto';
}

async function caricaMessaggi(){
  const { data, error } = await sb.from('messaggi').select('*')
    .eq(_colonnaCanaleMsg(), _idCanaleMsgAttivo()).order('creato_il', { ascending:true });
  if(error){ document.getElementById('msgCorpo').innerHTML = `<p class="hint" style="text-align:center;">Non riesco a caricare i messaggi.</p>`; return; }
  _messaggi = data || [];
  renderMessaggi();
  segnaMessaggiLetti();
}

function renderMessaggi(){
  const box = document.getElementById('msgCorpo');
  if(_messaggi.length === 0){
    box.innerHTML = `<p class="hint" style="text-align:center; margin-top:20px;">Nessun messaggio ancora — scrivi il primo.</p>`;
    return;
  }
  box.innerHTML = _messaggi.map(m=>{
    const ora = new Date(m.creato_il).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
    if(m.tipo && m.tipo !== 'testo'){
      return `<div class="msg-bolla evento">${escapeAttr(m.testo)}</div>`;
    }
    const mio = m.mittente_id === utenteOnline.id;
    return `<div class="msg-bolla ${mio?'io':'loro'}">${escapeAttr(m.testo)}<span class="ora">${ora}</span></div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

async function segnaMessaggiLetti(){
  const daSegnare = _messaggi.filter(m=>m.mittente_id !== utenteOnline.id && !m.letto);
  if(daSegnare.length === 0) return;
  await sb.from('messaggi').update({ letto:true }).eq(_colonnaCanaleMsg(), _idCanaleMsgAttivo()).neq('mittente_id', utenteOnline.id);
}

function ascoltaMessaggi(id, tipo){
  const colonna = tipo === 'chat' ? 'chat_id' : 'rapporto_id';
  if(_canaleMessaggi) sb.removeChannel(_canaleMessaggi);
  _canaleMessaggi = sb.channel(`messaggi-${tipo}-${id}`)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'messaggi', filter:`${colonna}=eq.${id}` }, payload=>{
      if(_messaggi.some(m=>m.id === payload.new.id)) return;
      _messaggi.push(payload.new);
      renderMessaggi();
      if(payload.new.mittente_id !== utenteOnline.id) segnaMessaggiLetti();
    })
    .subscribe();
}

async function inviaMessaggioTesto(){
  const input = document.getElementById('msgTestoInput');
  const testo = input.value.trim();
  const idCanale = _idCanaleMsgAttivo();
  if(!testo || !idCanale) return;
  input.value = '';
  const riga = { mittente_id: utenteOnline.id, testo, tipo:'testo' };
  riga[_colonnaCanaleMsg()] = idCanale;
  const { error } = await sb.from('messaggi').insert(riga);
  if(error){ toast("Messaggio non inviato: riprova."); input.value = testo; }
}
// avviso "automatico" nella chat quando scheda/dieta di qualcuno viene aggiornata,
// così chi lo riceve capisce subito perché senza dover controllare da solo
async function avvisaInChat(rapportoId, testo){
  if(!sb || !utenteOnline || !rapportoId) return;
  try{ await sb.from('messaggi').insert({ rapporto_id: rapportoId, mittente_id: utenteOnline.id, testo, tipo:'evento' }); }
  catch(e){ console.error(e); }
}

document.getElementById('msgChiudiBtn').addEventListener('click', chiudiMessaggi);
document.getElementById('msgInviaBtn').addEventListener('click', inviaMessaggioTesto);
document.getElementById('msgTestoInput').addEventListener('keydown', e=>{ if(e.key==='Enter') inviaMessaggioTesto(); });

function ascoltaMioProfilo(){
  if(!sb || !rigaOnline) return;
  if(_canaleMioProfilo){ sb.removeChannel(_canaleMioProfilo); _canaleMioProfilo = null; }
  _canaleMioProfilo = sb.channel('mio-profilo-' + rigaOnline.id)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'profili', filter: `id=eq.${rigaOnline.id}`
    }, payload => gestisciMioProfiloAggiornato(payload.new))
    .subscribe();
}

function gestisciMioProfiloAggiornato(nuovaRiga){
  if(!nuovaRiga || !rigaOnline) return;
  const eraApprovato = rigaOnline.approvato;
  const eraPT = sonoPT();

  rigaOnline = Object.assign({}, rigaOnline, nuovaRiga);

  // bloccato da chi gestisce l'app: schermata dedicata subito (non un toast
  // che sparisce in fretta), poi un ricaricamento di sicurezza — a quel punto
  // il login online rientra dal ramo qui sopra e mostra la stessa schermata,
  // stavolta con un "Esci" per poter uscire davvero
  if(eraApprovato && !rigaOnline.approvato){
    mostraAccountBloccatoOverlay();
    setTimeout(()=>location.reload(), 5000);
    return;
  }
  // sbloccato mentre questa scheda era ancora aperta sulla schermata di blocco
  if(!eraApprovato && rigaOnline.approvato){
    nascondiAccountBloccatoOverlay();
    toast("Il tuo accesso è stato ripristinato ✓");
    setTimeout(()=>location.reload(), 1200);
    return;
  }

  // appellativo di Personal Trainer dato o tolto
  const oraPT = sonoPT();
  if(oraPT !== eraPT){
    document.getElementById('homePTBtn').style.display = oraPT ? 'flex' : 'none';
    toast(oraPT ? "Ora sei Personal Trainer ✓" : "L'appellativo di Personal Trainer ti è stato tolto");
    // se te lo tolgono mentre sei dentro l'area riservata, ti riporto fuori
    if(!oraPT && document.getElementById('areaPT').style.display === 'block') chiudiAreaPT();
  }
}

async function caricaRapporti(){
  if(!sb || !utenteOnline) return [];
  const { data, error } = await sb.from('rapporti_pt')
    .select('*')
    .or(`cliente_id.eq.${utenteOnline.id},pt_id.eq.${utenteOnline.id}`);
  if(error){ console.error(error); return []; }
  _rapporti = data || [];
  return _rapporti;
}

function mioRapportoAttivo(){
  return _rapporti.find(r => r.cliente_id === (utenteOnline||{}).id && r.stato === 'attivo');
}
function miaRichiestaInSospeso(){
  return _rapporti.find(r => r.cliente_id === (utenteOnline||{}).id && r.stato === 'in_attesa');
}

// ---------- lato cliente: chiedere di essere seguito ----------
async function renderMioPT(){
  const box = document.getElementById('statoMioPT');
  const tastoPiu = document.getElementById('chiediPTBtn');
  if(!box) return;
  if(!modalitaOnline() || !utenteOnline){
    document.getElementById('cardMioPT').style.display = 'none';
    return;
  }
  // Su Storico la card resta sempre nascosta (vedi apriStorico()), anche se
  // questa funzione viene richiamata mentre Storico è ancora la schermata attiva.
  const suStorico = document.querySelector('#navTabsGlobale button[data-go="storico"]')?.classList.contains('active');
  document.getElementById('cardMioPT').style.display = suStorico ? 'none' : 'block';

  await caricaRapporti();
  const attivo = mioRapportoAttivo();
  const sospeso = miaRichiestaInSospeso();
  tastoPiu.style.display = (attivo || sospeso) ? 'none' : 'inline-block';

  if(attivo){
    const pt = await leggiProfilo(attivo.pt_id);
    _mioPTNomeCache = nomeDi(pt);
    // Card PT compatta (31/08/2026, richiesta esplicita: "quello che ho io
    // oggi si prende troppo spazio" — riga avatar+nome+messaggi su una riga
    // sola, ispirata alla card di fitflow). La versione precedente (Fase 2)
    // nascondeva permessi e "Termina rapporto" dietro una <details>: tolta
    // su richiesta esplicita dell'utente ("non mi convincono molto" proprio
    // riferito a questa) — restano sempre a vista ma in una riga compatta
    // (due interruttori piccoli), non più nella forma ingombrante di prima
    // (2 righe intere + un bottone a tutta larghezza).
    // "Termina rapporto" (02/09/2026): era un link testuale accanto ai
    // permessi, troppo facile da toccare per sbaglio. Spostato in fondo,
    // sotto "Compila", come vero bottone separato da un bordo.
    box.innerHTML = `
      <div class="pt-riga pt-riga-compatta">
        <div class="pt-avatar">${avatarContentHtml(nomeDi(pt), (pt.dati||{}).avatarUrl)}</div>
        <div class="info">
          <div class="nome">${nomeDi(pt)}<span class="pt-badge">ti segue</span></div>
          <div class="meta">dal ${formatDate((attivo.accettato_il||'').slice(0,10))}</div>
        </div>
        <button class="icon-btn-round" id="apriMessaggiClienteBtn" aria-label="Messaggi" title="Messaggi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>
        </button>
      </div>
      <div class="pt-permessi-compatta">
        <span class="pt-permessi-label">Può modificare</span>
        <label class="pt-permesso-mini" title="Può modificare la mia scheda">
          <span class="interruttore interruttore-sm"><input type="checkbox" id="permScheda" ${attivo.puo_scheda?'checked':''}><span></span></span>
          Scheda
        </label>
        <label class="pt-permesso-mini" title="Può modificare la mia dieta">
          <span class="interruttore interruttore-sm"><input type="checkbox" id="permDieta" ${attivo.puo_dieta?'checked':''}><span></span></span>
          Dieta
        </label>
      </div>
      ${attivo.checkin_attivo ? (()=>{
          // Cadenza decisa dal PT per QUESTO rapporto (attivo.checkin_cadenza_settimane):
          // mai un valore fisso uguale per tutti — vedi prossimoCheckinScadenza() in costanti.js.
          const lp = loggedInProfile();
          const dovuto = checkinDovuto(attivo, lp && lp.checkins);
          const n = attivo.checkin_cadenza_settimane || 1;
          return `<div class="pt-checkin-riga${dovuto?' dovuto':''}">
            <span class="pt-checkin-label">${dovuto ? '🔔 Check-in da fare' : `Check-in ogni ${n} settiman${n===1?'a':'e'}`}</span>
            <button type="button" class="btn ghost" id="apriCheckinBtn" style="margin-top:0; padding:6px 12px; font-size:11.5px;">Compila</button>
          </div>`;
        })() : ''}
      <div class="pt-termina-riga">
        <button type="button" class="pt-termina-btn" id="chiudiRapportoBtn">Termina rapporto</button>
      </div>`;

    document.getElementById('permScheda').addEventListener('change', e=>cambiaPermesso(attivo.id, 'puo_scheda', e.target.checked));
    document.getElementById('permDieta').addEventListener('change', e=>cambiaPermesso(attivo.id, 'puo_dieta', e.target.checked));
    document.getElementById('apriMessaggiClienteBtn').addEventListener('click', ()=>apriMessaggi(attivo.id, attivo.pt_id, nomeDi(pt)));
    const apriCheckinBtn = document.getElementById('apriCheckinBtn');
    if(apriCheckinBtn) apriCheckinBtn.addEventListener('click', apriCheckinCompilazione);
    document.getElementById('chiudiRapportoBtn').addEventListener('click', ()=>{
      customConfirm(`Terminare il rapporto con ${nomeDi(pt)}? Non potrà più vedere né modificare i tuoi dati. La scheda che ti ha assegnato resta tua.`,
        ()=>terminaRapporto(attivo.id));
    });
  } else if(sospeso){
    const pt = await leggiProfilo(sospeso.pt_id);
    box.innerHTML = `
      <div class="pt-riga">
        <div class="info">
          <div class="nome">${nomeDi(pt)}</div>
          <div class="meta">richiesta inviata, in attesa che accetti</div>
        </div>
        <div class="azioni"><button class="pericolo" id="annullaRichiestaBtn">Annulla</button></div>
      </div>`;
    document.getElementById('annullaRichiestaBtn').addEventListener('click', ()=>{
      customConfirm("Annullare la richiesta?", async ()=>{
        await sb.from('rapporti_pt').delete().eq('id', sospeso.id);
        toast("Richiesta annullata");
        renderMioPT();
      });
    });
  } else {
    box.innerHTML = '<div class="hint">Nessun Personal Trainer. Con il tasto <b>+</b> puoi chiedere a uno dei trainer disponibili di seguirti.</div>';
    _mioPTNomeCache = null;
  }
  // riflette il nome del PT (appena arrivato dalla rete) nella card compatta di Scheda,
  // se quella schermata esiste già ed è già stata popolata almeno una volta
  if(typeof renderSchedaView === 'function' && activeProgram() && document.getElementById('programView')){
    renderSchedaView();
  }
}

async function leggiProfilo(id){
  const { data } = await sb.from('profili').select('id,nome,nome_pubblico,email,is_pt,dati').eq('id', id).maybeSingle();
  return data;
}

async function cambiaPermesso(idRapporto, campo, valore){
  const patch = {}; patch[campo] = valore;
  const { error } = await sb.from('rapporti_pt').update(patch).eq('id', idRapporto);
  toast(error ? ("Non riuscito: " + error.message)
              : (valore ? "Permesso concesso ✓" : "Permesso revocato"));
}

async function terminaRapporto(idRapporto){
  // i permessi si spengono anche da qui: il database lo fa già, ma così l'accesso
  // finisce comunque, anche se le regole non fossero state installate
  const { error } = await sb.from('rapporti_pt')
    .update({ stato:'terminato', puo_scheda:false, puo_dieta:false })
    .eq('id', idRapporto);
  if(error){ toast("Non riuscito: " + error.message); return; }
  toast("Rapporto terminato");
  await renderMioPT();
  if(document.getElementById('areaPT').style.display !== 'none') renderAreaPT();
}

