-- Estado da integração automática com a NBA
create table if not exists public.nba_sync_state (
  id text primary key,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_mode text,
  source text,
  games_upserted integer not null default 0,
  last_error text,
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.nba_sync_state enable row level security;
revoke all on public.nba_sync_state from anon, authenticated;
