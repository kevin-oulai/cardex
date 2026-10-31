-- CARDEX account-bound cloud saves.
-- Apply after schema.sql and leaderboard-migration.sql.
-- This stores existing gameplay state per authenticated account, but is NOT
-- authoritative for competitive card issuance or verified leaderboards.
create table if not exists public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint player_saves_object check (jsonb_typeof(state) = 'object'),
  constraint player_saves_size check (octet_length(state::text) <= 2000000)
);
alter table public.player_saves enable row level security;
drop policy if exists "Own save readable" on public.player_saves;
create policy "Own save readable" on public.player_saves
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Own save insertable" on public.player_saves;
create policy "Own save insertable" on public.player_saves
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Own save editable" on public.player_saves;
create policy "Own save editable" on public.player_saves
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- Never derive verified ownership, global serials or ranked scores from this table.
