-- Automação NBA do Bolão NBA
-- Supabase Edge Function: nba-sync
-- Site: https://nbadabet.vercel.app/

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Atualiza status/placares do dia a cada 10 minutos.
select cron.schedule(
  'nba-sync-live',
  '*/10 * * * *',
  $$
    select net.http_post(
      url := 'https://wueaswmbujgitfxydphh.supabase.co/functions/v1/nba-sync',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"mode":"live"}'::jsonb
    );
  $$
);

-- Recarrega a janela de calendário futuro a cada 6 horas.
select cron.schedule(
  'nba-sync-calendar',
  '17 */6 * * *',
  $$
    select net.http_post(
      url := 'https://wueaswmbujgitfxydphh.supabase.co/functions/v1/nba-sync',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{"mode":"calendar"}'::jsonb
    );
  $$
);
