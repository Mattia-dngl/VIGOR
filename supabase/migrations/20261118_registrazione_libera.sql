-- Registrazione libera (18/11/2026): chi si iscrive entra subito, senza
-- aspettare l'approvazione dell'amministratore.
-- Il blocco sulle MODIFICHE resta: nessuno può cambiarsi da solo approvato/is_pt
-- (trigger blocca_autoapprovazione); il blocco account (bloccato) resta separato.
-- Per tornare all'approvazione manuale: new.approvato := privato.sono_admin();
create or replace function public.approvazione_iniziale()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  new.approvato := true;
  return new;
end $$;
