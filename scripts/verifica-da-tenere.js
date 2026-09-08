#!/usr/bin/env node
'use strict';
// ============================================================
// Task 6c (roadmap VIGOR) — guardia CI per la regola del CLAUDE.md:
// "Se aggiungi/rinomini un file .js o .css: aggiornalo in DA_TENERE dentro
// sw.js e alza VERSIONE. Altrimenti si rompe l'offline."
//
// Due controlli:
//  1) Ogni .js/.css sotto js/ e css/ deve comparire in DA_TENERE (sw.js).
//  2) Se il confronto richiesto (VERIFICA_BASE_REF) mostra che un file
//     già in DA_TENERE è cambiato, VERSIONE deve essere cambiata anche lei
//     nello stesso confronto — altrimenti chi ha già la PWA installata
//     continua a vedere la versione vecchia in cache.
//
// Uso locale: node scripts/verifica-da-tenere.js
// (il controllo 2 gira solo se VERIFICA_BASE_REF è impostata, es. dalla CI)
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const swContent = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const daTenereMatch = swContent.match(/const DA_TENERE = \[([\s\S]*?)\];/);
if(!daTenereMatch){ console.error('Non trovo DA_TENERE in sw.js'); process.exit(1); }
const daTenere = new Set([...daTenereMatch[1].matchAll(/"(\.\/[^"]+)"/g)].map(m => m[1]));

const versioneMatch = swContent.match(/const VERSIONE = "([^"]+)"/);
if(!versioneMatch){ console.error('Non trovo VERSIONE in sw.js'); process.exit(1); }

function elencaFile(dir, estensioni){
  let risultato = [];
  if(!fs.existsSync(dir)) return risultato;
  for(const voce of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, voce.name);
    if(voce.isDirectory()) risultato = risultato.concat(elencaFile(p, estensioni));
    else if(estensioni.includes(path.extname(voce.name))) risultato.push(p);
  }
  return risultato;
}

let erroriTrovati = false;

// 1) ogni .js/.css sotto js/ e css/ deve essere in DA_TENERE
const fileServiti = [
  ...elencaFile(path.join(ROOT, 'js'), ['.js']),
  ...elencaFile(path.join(ROOT, 'css'), ['.css'])
].map(p => './' + path.relative(ROOT, p).split(path.sep).join('/'));

for(const f of fileServiti){
  if(!daTenere.has(f)){
    console.error(`Manca in DA_TENERE (sw.js): ${f}`);
    erroriTrovati = true;
  }
}

// 2) file già in DA_TENERE cambiati senza alzare VERSIONE
const base = process.env.VERIFICA_BASE_REF;
if(base){
  try{
    const fileModificati = execSync(`git diff --name-only ${base} HEAD`, { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean).map(f => './' + f);
    const swModificato = fileModificati.includes('./sw.js');
    let versioneModificata = false;
    if(swModificato){
      const swPrecedente = execSync(`git show ${base}:sw.js`, { cwd: ROOT, encoding: 'utf8' });
      const versionePrecedente = (swPrecedente.match(/const VERSIONE = "([^"]+)"/) || [])[1];
      versioneModificata = versionePrecedente !== versioneMatch[1];
    }
    const cachatoModificato = fileModificati.filter(f => daTenere.has(f) && f !== './sw.js');
    if(cachatoModificato.length > 0 && !versioneModificata){
      console.error('File serviti dalla cache offline modificati senza alzare VERSIONE in sw.js:');
      cachatoModificato.forEach(f => console.error(`  - ${f}`));
      erroriTrovati = true;
    }
  }catch(e){
    console.error('Impossibile confrontare con la base (' + base + '): ' + e.message);
  }
} else {
  console.log('VERIFICA_BASE_REF non impostata: salto il controllo su VERSIONE (solo il controllo DA_TENERE).');
}

if(erroriTrovati) process.exit(1);
console.log('Tutto ok: DA_TENERE è completo' + (base ? ' e VERSIONE è coerente.' : '.'));
