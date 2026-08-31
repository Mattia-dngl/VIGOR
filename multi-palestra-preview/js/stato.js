// ============================================================
// STATO — piccolo store centrale con pub/sub, per far comunicare
// le schermate senza che si conoscano direttamente tra loro.
// Nessuna dipendenza esterna: se in futuro l'app userà un altro
// meccanismo di stato, questo file è quello da sostituire.
// ============================================================
window.MP = window.MP || {};

MP.stato = (function () {
  let stato = {
    schermata: 'switcher', // switcher | aggiungi | badge | app
    palestraSelezionataId: null
  };
  const ascoltatori = [];

  function get() {
    return stato;
  }

  function set(parziale) {
    stato = Object.assign({}, stato, parziale);
    ascoltatori.forEach(fn => fn(stato));
  }

  function osserva(fn) {
    ascoltatori.push(fn);
  }

  function vaiA(schermata, extra) {
    set(Object.assign({ schermata }, extra || {}));
  }

  return { get, set, osserva, vaiA };
})();
