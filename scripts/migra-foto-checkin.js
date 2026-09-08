#!/usr/bin/env node
'use strict';
// ============================================================
// MIGRAZIONE — foto di check-in da base64 (dentro profili.dati) a Storage
// (bucket privato "checkin-foto"). Task 2a della roadmap VIGOR.
//
// Non è servita dall'app (non è in sw.js/DA_TENERE): è uno script da lanciare
// UNA TANTUM in locale, a mano, quando si decide di migrare i dati esistenti.
// Usa solo moduli nativi di Node (fetch, niente librerie nuove) e parla
// direttamente con le API REST/Storage di Supabase con la SERVICE ROLE KEY,
// che bypassa le RLS: per questo va lanciata solo da chi la possiede, mai
// spedita nel repo o incollata in chat.
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-foto-checkin.js
//   SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-foto-checkin.js --dry-run
//
// (--dry-run: scrive solo cosa farebbe, senza caricare né modificare nulla)
//
// Ripetibile: salta i check-in che hanno già fotoPath o che non hanno un
// fotoUrl in base64. Un fallimento su un profilo/foto non blocca gli altri:
// resta segnalato nel riepilogo finale, pronto per un secondo giro. Per
// ogni foto: carica -> VERIFICA che sia arrivata integra -> SOLO DOPO toglie
// il base64 dal record, mai il contrario.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oyllkwjcfszehugqdxlb.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const BUCKET = 'checkin-foto';
const PAGINA = 200;

if(!SERVICE_KEY){
  console.error('Manca SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role).');
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-foto-checkin.js [--dry-run]');
  process.exit(1);
}

function headersServizio(extra){
  return Object.assign({
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`
  }, extra || {});
}

async function leggiProfiliPagina(offset){
  const url = `${SUPABASE_URL}/rest/v1/profili?select=id,dati&order=id&limit=${PAGINA}&offset=${offset}`;
  const res = await fetch(url, { headers: headersServizio() });
  if(!res.ok) throw new Error(`Lettura profili fallita (${res.status}): ${await res.text()}`);
  return res.json();
}

// Un data URL è tipo "data:image/jpeg;base64,AAAA...": estrae mime + buffer.
function decodificaDataUrl(dataUrl){
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if(!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

async function caricaSuStorage(path, buffer, mime){
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: headersServizio({ 'Content-Type': mime, 'x-upsert': 'true' }),
    body: buffer
  });
  if(!res.ok) throw new Error(`Upload fallito (${res.status}): ${await res.text()}`);
}

// Verifica che la foto sia arrivata integra: la riscarica e confronta la
// dimensione con l'originale. Non fidarsi mai di una risposta 200 da sola.
async function verificaSuStorage(path, dimensioneAttesa){
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${path}`, {
    headers: headersServizio()
  });
  if(!res.ok) return false;
  const arrivata = await res.arrayBuffer();
  return arrivata.byteLength === dimensioneAttesa;
}

async function aggiornaProfilo(id, dati){
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profili?id=eq.${id}`, {
    method: 'PATCH',
    headers: headersServizio({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ dati })
  });
  if(!res.ok) throw new Error(`Scrittura profilo fallita (${res.status}): ${await res.text()}`);
}

async function migraProfilo(riga, riepilogo){
  const dati = riga.dati || {};
  const checkins = dati.checkins || [];
  let cambiato = false;

  for(const c of checkins){
    if(c.fotoPath) continue;                 // già migrato: idempotente
    if(!c.fotoUrl || !c.fotoUrl.startsWith('data:image')) continue; // niente da migrare

    const decodificato = decodificaDataUrl(c.fotoUrl);
    if(!decodificato){
      riepilogo.falliti.push({ profilo: riga.id, checkin: c.id, motivo: 'data URL non valido' });
      continue;
    }
    const path = `${riga.id}/${c.id}.jpg`;
    if(DRY_RUN){
      console.log(`[dry-run] migrerei ${path} (${decodificato.buffer.length} byte)`);
      riepilogo.migrati.push({ profilo: riga.id, checkin: c.id, path });
      continue;
    }
    try{
      await caricaSuStorage(path, decodificato.buffer, decodificato.mime || 'image/jpeg');
      const integra = await verificaSuStorage(path, decodificato.buffer.length);
      if(!integra){
        riepilogo.falliti.push({ profilo: riga.id, checkin: c.id, motivo: 'verifica fallita dopo l\'upload' });
        continue; // NON tocca fotoUrl: resta per un secondo giro
      }
      c.fotoPath = path;
      delete c.fotoUrl;
      cambiato = true;
      riepilogo.migrati.push({ profilo: riga.id, checkin: c.id, path });
    }catch(e){
      riepilogo.falliti.push({ profilo: riga.id, checkin: c.id, motivo: e.message });
    }
  }

  if(cambiato && !DRY_RUN){
    await aggiornaProfilo(riga.id, dati);
  }
}

async function main(){
  console.log(DRY_RUN ? 'Modalità dry-run: nessuna scrittura, solo un riepilogo di cosa verrebbe fatto.' : 'Avvio migrazione...');
  const riepilogo = { profiliVisti: 0, migrati: [], falliti: [] };
  let offset = 0;
  while(true){
    const pagina = await leggiProfiliPagina(offset);
    if(pagina.length === 0) break;
    for(const riga of pagina){
      riepilogo.profiliVisti++;
      try{
        await migraProfilo(riga, riepilogo);
      }catch(e){
        // Un profilo che fallisce per intero (es. scrittura finale non riuscita)
        // non deve fermare gli altri: resta segnalato, si ritenta al prossimo giro.
        riepilogo.falliti.push({ profilo: riga.id, checkin: null, motivo: e.message });
      }
    }
    offset += PAGINA;
  }

  console.log('\n--- Riepilogo ---');
  console.log(`Profili controllati: ${riepilogo.profiliVisti}`);
  console.log(`Foto migrate: ${riepilogo.migrati.length}`);
  console.log(`Foto non riuscite (da riprovare): ${riepilogo.falliti.length}`);
  if(riepilogo.falliti.length){
    console.log('\nDettaglio dei falliti:');
    riepilogo.falliti.forEach(f => console.log(`  - profilo ${f.profilo}${f.checkin ? ', check-in ' + f.checkin : ''}: ${f.motivo}`));
    console.log('\nRilancia lo stesso comando per riprovare solo questi: lo script salta chi è già migrato.');
  }
}

main().catch(e => { console.error('Errore imprevisto:', e); process.exit(1); });
