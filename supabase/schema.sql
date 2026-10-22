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
