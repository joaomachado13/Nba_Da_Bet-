-- Exceção pontual de votação: permite prorrogar uma rodada sem alterar o horário real dos jogos.
create schema if not exists private;

create table if not exists public.round_voting_overrides (
  round_date date primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.round_voting_overrides enable row level security;
drop policy if exists "round voting overrides authenticated read" on public.round_voting_overrides;
create policy "round voting overrides authenticated read"
on public.round_voting_overrides for select to authenticated using (true);
grant select on public.round_voting_overrides to authenticated;

create or replace function private.is_round_voting_override_active(p_round_date date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.round_voting_overrides o
    where o.round_date = p_round_date and o.expires_at > now()
  );
$$;
revoke all on function private.is_round_voting_override_active(date) from public;
grant execute on function private.is_round_voting_override_active(date) to authenticated;

drop policy if exists predictions_insert_before_round_lock on public.predictions;
create policy predictions_insert_before_round_lock on public.predictions
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.games g
    where g.id = predictions.game_id and g.status = 'scheduled'
      and (predictions.picked_team_code = g.away_team_code or predictions.picked_team_code = g.home_team_code)
      and (
        now() < (select min(g2.start_at) from public.games g2
          where g2.round_date = g.round_date and g2.status <> all (array['postponed','cancelled']::text[]))
        or private.is_round_voting_override_active(g.round_date)
      )
  )
);

drop policy if exists predictions_update_before_round_lock on public.predictions;
create policy predictions_update_before_round_lock on public.predictions
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.games g where g.id = predictions.game_id
      and (
        now() < (select min(g2.start_at) from public.games g2
          where g2.round_date = g.round_date and g2.status <> all (array['postponed','cancelled']::text[]))
        or private.is_round_voting_override_active(g.round_date)
      )
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.games g
    where g.id = predictions.game_id and g.status = 'scheduled'
      and (predictions.picked_team_code = g.away_team_code or predictions.picked_team_code = g.home_team_code)
      and (
        now() < (select min(g2.start_at) from public.games g2
          where g2.round_date = g.round_date and g2.status <> all (array['postponed','cancelled']::text[]))
        or private.is_round_voting_override_active(g.round_date)
      )
  )
);

drop policy if exists predictions_delete_before_round_lock on public.predictions;
create policy predictions_delete_before_round_lock on public.predictions
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.games g where g.id = predictions.game_id
      and (
        now() < (select min(g2.start_at) from public.games g2
          where g2.round_date = g.round_date and g2.status <> all (array['postponed','cancelled']::text[]))
        or private.is_round_voting_override_active(g.round_date)
      )
  )
);

drop policy if exists predictions_select_own_or_revealed on public.predictions;
create policy predictions_select_own_or_revealed on public.predictions
for select to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.games g
    where g.id = predictions.game_id
      and now() >= case
        when private.is_round_voting_override_active(g.round_date)
          then (select o.expires_at from public.round_voting_overrides o where o.round_date = g.round_date)
        else (select min(g2.start_at) from public.games g2
          where g2.round_date = g.round_date and g2.status <> all (array['postponed','cancelled']::text[]))
      end
  )
);
