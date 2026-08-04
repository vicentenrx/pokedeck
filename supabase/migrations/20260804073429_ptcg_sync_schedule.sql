-- Agenda sync-ptcg-sets pra rodar sozinha toda semana, sem depender de
-- ninguém (Vicente ou eu) lembrar de rodar isso manualmente. pg_cron agenda
-- o job dentro do próprio Postgres; pg_net faz o POST HTTP pra Edge Function
-- de dentro do banco (sem precisar de um servidor externo rodando 24/7).
--
-- A chave usada no header é a publishable/anon key -- a mesma que já fica
-- hardcoded em js/constants.js, pensada pra ser pública. A Edge Function em
-- si é quem usa a service_role (injetada automaticamente no runtime dela,
-- nunca aparece aqui) pra de fato escrever em ptcg_cards.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'sync-ptcg-sets-weekly',
  '17 6 * * 1', -- toda segunda-feira, 06:17 UTC (horário fora de hora cheia de propósito, evita competir com outros jobs agendados exatamente em :00)
  $$
  select net.http_post(
    url := 'https://izaeernhfzmrulztouvd.supabase.co/functions/v1/sync-ptcg-sets',
    headers := jsonb_build_object(
      'apikey', 'sb_publishable_P6r1fbSpZ-aYDTlT0yuXjg_6wodIp3A',
      'Authorization', 'Bearer sb_publishable_P6r1fbSpZ-aYDTlT0yuXjg_6wodIp3A',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
