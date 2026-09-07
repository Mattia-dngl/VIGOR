'use strict';
// ============================================================
// VIGOR — landing.html: rilevamento OS/browser per la sezione
// "Come si installa" e gestione dei tab Android/iPhone.
// Funzioni esposte su window (non moduli: la pagina non ha build step)
// così i test possono chiamarle direttamente dentro jsdom.
// ============================================================

// Preso a parte (non richiamato da navigator.userAgent direttamente) così i
// test possono passare stringhe finte senza dover truccare l'ambiente jsdom.
function rilevaSistemaOperativo(userAgent){
  const ua = String(userAgent || '');
  if(/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if(/Android/.test(ua)) return 'android';
  return 'altro';
}

// Instagram, Facebook, Messenger, TikTok, LinkedIn: i browser interni di
// queste app spesso bloccano l'installazione della PWA (niente "Aggiungi a
// Home" reale in Safari-in-webview). Su iPhone è per questo che l'avviso
// "apri in Safari" deve comparire SUBITO, non solo dentro al tab iPhone.
function rilevaWebviewSocial(userAgent){
  const ua = String(userAgent || '');
  return /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|MicroMessenger|TikTok|LinkedInApp/i.test(ua);
}

function inizializzaTab(tablist){
  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  const pannelli = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));

  function attiva(indice, spostaFocus){
    tabs.forEach((tab, i) => {
      const attivo = i === indice;
      tab.setAttribute('aria-selected', attivo ? 'true' : 'false');
      tab.tabIndex = attivo ? 0 : -1;
      if(pannelli[i]) pannelli[i].hidden = !attivo;
    });
    if(spostaFocus) tabs[indice].focus();
  }

  tabs.forEach((tab, indice) => {
    tab.addEventListener('click', () => attiva(indice, false));
    tab.addEventListener('keydown', (ev) => {
      let prossimo = null;
      if(ev.key === 'ArrowRight' || ev.key === 'ArrowDown') prossimo = (indice + 1) % tabs.length;
      else if(ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') prossimo = (indice - 1 + tabs.length) % tabs.length;
      else if(ev.key === 'Home') prossimo = 0;
      else if(ev.key === 'End') prossimo = tabs.length - 1;
      if(prossimo !== null){
        ev.preventDefault();
        attiva(prossimo, true);
      }
    });
  });

  return { attiva };
}

function inizializzaPaginaInstallazione(){
  const tablist = document.querySelector('.install-tablist');
  if(!tablist) return;
  const { attiva } = inizializzaTab(tablist);

  const os = rilevaSistemaOperativo(navigator.userAgent);
  attiva(os === 'ios' ? 1 : 0, false);

  const avviso = document.getElementById('installAvvisoSafari');
  if(avviso && os === 'ios' && rilevaWebviewSocial(navigator.userAgent)){
    avviso.classList.add('mostra');
  }

  const copiaBtn = document.getElementById('installCopiaLinkBtn');
  if(copiaBtn){
    copiaBtn.addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(location.href);
        copiaBtn.textContent = 'Link copiato!';
        setTimeout(() => { copiaBtn.textContent = 'Copia il link'; }, 2200);
      }catch(e){
        copiaBtn.textContent = 'Copia il link qui sopra a mano';
      }
    });
  }
}

if(typeof window !== 'undefined'){
  window.rilevaSistemaOperativo = rilevaSistemaOperativo;
  window.rilevaWebviewSocial = rilevaWebviewSocial;
  window.inizializzaPaginaInstallazione = inizializzaPaginaInstallazione;
  document.addEventListener('DOMContentLoaded', inizializzaPaginaInstallazione);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { rilevaSistemaOperativo, rilevaWebviewSocial };
}
