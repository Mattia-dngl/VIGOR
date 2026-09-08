#!/usr/bin/env node
'use strict';
// ============================================================
// MIGRAZIONE — copia gli allenamenti già esistenti (dentro
// profili.dati.logs, JSONB) nella tabella "allenamenti".
// Task 4a della roadmap VIGOR, terzo pezzo.
//
// Stesso schema degli altri script in questa cartella: solo moduli nativi
// di Node, service role key (mai nel repo/in chat).
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-allenamenti.js
//   SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-allenamenti.js --dry-run
//
// Ripetibile: upsert su id (lo stesso id generato dal client con uid()),
// non duplica chi è già migrato. Non tocca né cancella mai dati.logs.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oyllkwjcfszehugqdxlb.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const PAGINA = 200;

if(!SERVICE_KEY){
  console.error('Manca SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role).');
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migra-allenamenti.js [--dry-run]');
  process.exit(1);
}

function headersServizio(extra){
  return Object.assign({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, extra || {});
}

async function leggiProfiliPagina(offset){
  const url = `${SUPABASE_URL}/rest/v1/profili?select=id,dati&order=id&limit=${PAGINA}&offset=${offset}`;
  const res = await fetch(url, { headers: headersServizio() });
  if(!res.ok) throw new Error(`Lettura profili fallita (${res.status}): ${await res.text()}`);
  return res.json();
}

async function upsertAllenamenti(righe){
  if(righe.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/allenamenti?on_conflict=id`, {
    method: 'POST',
    headers: headersServizio({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(righe)
  });
  if(!res.ok) throw new Error(`Upsert allenamenti fallito (${res.status}): ${await res.text()}`);
}

async function main(){
  console.log(DRY_RUN ? 'Modalità dry-run: nessuna scrittura, solo un riepilogo di cosa verrebbe fatto.' : 'Avvio migrazione allenamenti...');
  let profiliVisti = 0, logMigrati = 0, profiliFalliti = [];
  let offset = 0;
  while(true){
    const pagina = await leggiProfiliPagina(offset);
    if(pagina.length === 0) break;
    for(const riga of pagina){
      profiliVisti++;
      const logs = ((riga.dati || {}).logs || []).filter(l => l && l.id && l.date && l.status);
      if(logs.length === 0) continue;
      // in blocchi da 500: profili con anni di storico possono avere
      // migliaia di allenamenti, meglio non mandarli in un'unica richiesta
      for(let i=0; i<logs.length; i+=500){
        const blocco = logs.slice(i, i+500).map(l => ({
          id: l.id, profilo_id: riga.id, data: l.date, program_id: l.programId || null,
          status: l.status, day_key: l.dayKey || null, day_name: l.dayName || null,
          exercises: l.exercises || [], notes: l.notes || null, auto: !!l.auto
        }));
        if(DRY_RUN){
          console.log(`[dry-run] migrerei ${blocco.length} allenamenti per il profilo ${riga.id}`);
          logMigrati += blocco.length;
          continue;
        }
        try{
          await upsertAllenamenti(blocco);
          logMigrati += blocco.length;
        }catch(e){
          profiliFalliti.push({ profilo: riga.id, motivo: e.message });
        }
      }
    }
    offset += PAGINA;
  }

  console.log('\n--- Riepilogo ---');
  console.log(`Profili controllati: ${profiliVisti}`);
  console.log(`Allenamenti migrati: ${logMigrati}`);
  console.log(`Profili falliti (da riprovare): ${profiliFalliti.length}`);
  profiliFalliti.forEach(f => console.log(`  - profilo ${f.profilo}: ${f.motivo}`));
  if(profiliFalliti.length) console.log('\nRilancia lo stesso comando per riprovare: l\'upsert non duplica chi è già migrato.');
}

main().catch(e => { console.error('Errore imprevisto:', e); process.exit(1); });
