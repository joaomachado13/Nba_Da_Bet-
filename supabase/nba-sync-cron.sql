-- Automação NBA do Bolão NBA
-- Edge Function: nba-sync

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Scoreboard/status/placares: a cada 5 minutos.
select cron.schedule(
  'nba-sync-fast',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://wueaswmbujgitfxydphh.supabase.co/functions/v1/nba-sync',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"mode":"fast"}'::jsonb,
      timeout_milliseconds := 15000
    );
  $$
);

-- Calendário futuro: diariamente às 09:10 UTC = 06:10 BRT.
-- A função carrega uma janela de ontem até +10 dias.
select cron.schedule(
  'nba-sync-full',
  '10 9 * * *',
  $$
    select net.http_post(
      url := 'https://wueaswmbujgitfxydphh.supabase.co/functions/v1/nba-sync',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"mode":"full"}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
