-- Coleções distintas já importadas em ptcg_cards, usado pela Edge Function
-- sync-ptcg-sets pra saber quais coleções do dataset aberto ainda faltam.
-- "select set_id from ptcg_cards" direto bateria no limite padrão de linhas
-- por request do PostgREST (a tabela tem ~20 mil linhas) antes de cobrir
-- todas as ~150 coleções distintas -- essa função devolve só os IDs únicos,
-- um resultado pequeno, sem esse risco. Sem grant pra anon/authenticated de
-- propósito: só é chamada de dentro da Edge Function, com a service_role
-- (que já ignora RLS/grants de qualquer forma).
create or replace function public.distinct_ptcg_set_ids()
returns setof text
language sql
security definer
set search_path = public
stable
as $$
  select distinct set_id from public.ptcg_cards;
$$;
