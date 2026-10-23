-- Bolão NBA — schema aplicado no projeto Nba_da_bet
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  favorite_team_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id text primary key,
  round_date date not null,
  start_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','final','postponed','cancelled')),
  away_team_code text not null,
  away_team_name text not null,
  away_record text not null default '0-0',
  away_form jsonb not null default '[]'::jsonb,
  home_team_code text not null,
  home_team_name text not null,
  home_record text not null default '0-0',
  home_form jsonb not null default '[]'::jsonb,
  away_score integer,
  home_score integer,
  arena text,
  broadcast text,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  picked_team_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_id)
);

-- RLS está habilitado nas três tabelas no projeto real.
-- predictions: próprio usuário sempre vê o seu; os demais só após o lock da rodada.
-- insert/update/delete: somente o próprio usuário e somente antes do primeiro jogo da rodada.
-- standings: view security_invoker calculada a partir de resultados finais.
-- daily_rounds: view security_invoker calculando lock_at = primeiro jogo válido do round_date.



create table if not exists public.round_confirmations (
  user_id uuid not null references auth.users(id) on delete cascade,
  round_date date not null,
  confirmed_at timestamptz not null default now(),
  total_games integer not null default 0 check (total_games >= 0),
  picked_games integer not null default 0 check (picked_games >= 0),
  incomplete_count integer not null default 0 check (incomplete_count >= 0),
  primary key (user_id, round_date)
);

alter table public.round_confirmations enable row level security;

drop policy if exists "round confirmations own select" on public.round_confirmations;
create policy "round confirmations own select" on public.round_confirmations
for select to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "round confirmations own insert" on public.round_confirmations;
create policy "round confirmations own insert" on public.round_confirmations
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "round confirmations own update" on public.round_confirmations;
create policy "round confirmations own update" on public.round_confirmations
for update to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
)
with check (
  (select auth.uid()) = user_id
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "round confirmations own delete" on public.round_confirmations;
create policy "round confirmations own delete" on public.round_confirmations
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

grant select, insert, update, delete on public.round_confirmations to authenticated;
