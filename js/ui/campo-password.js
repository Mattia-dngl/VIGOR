// ============================================================
// ICONA "OCCHIO" nei campi password — mostra/nasconde il testo digitato.
// Funziona su qualunque input[type=password] già presente nell'HTML (Accedi,
// Registrati, recupero password locale e online, nuovo profilo, cambio
// password account...): un solo punto da mantenere invece di ripetere lo
// stesso codice in ogni modulo. Gli input sono tutti statici nell'HTML,
// quindi basta girarli una volta sola al caricamento della pagina.
// ============================================================
const ICONA_OCCHIO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICONA_OCCHIO_BARRATO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

function attivaOcchioPassword(){
  document.querySelectorAll('input[type=password]').forEach(input=>{
    if(input.closest('.pw-wrap')) return;   // già avvolto (chiamata ripetuta)
    const wrap = document.createElement('div');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle-btn';
    btn.setAttribute('aria-label', 'Mostra password');
    btn.innerHTML = ICONA_OCCHIO_SVG;
    wrap.appendChild(btn);

    btn.addEventListener('click', ()=>{
      const mostrata = input.type === 'text';
      input.type = mostrata ? 'password' : 'text';
      btn.innerHTML = mostrata ? ICONA_OCCHIO_SVG : ICONA_OCCHIO_BARRATO_SVG;
      btn.setAttribute('aria-label', mostrata ? 'Mostra password' : 'Nascondi password');
    });
  });
}
attivaOcchioPassword();
