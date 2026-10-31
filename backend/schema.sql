-- CARDEX online backend schema (Supabase PostgreSQL)
-- Apply in Supabase SQL Editor. This file creates tables and read policies,
-- but deliberately does NOT allow browser clients to mint cards or submit scores.
-- Trusted Edge Functions must validate pack issuance and Showdown outcomes.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Collector'
    check (char_length(display_name) between 1 and 24),
  created_at timestamptz not null default now()
);

create or replace function public.create_cardex_profile()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, 'Collector')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists cardex_user_created on auth.users;
create trigger cardex_user_created
after insert on auth.users for each row execute function public.create_cardex_profile();

create table if not exists public.global_card_serials (
  id bigint generated always as identity primary key,
  car_id integer not null check (car_id between 0 and 95),
  finish text not null check (finish in ('Standard','Foil','Holographic','Collector')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  issued_at timestamptz not null default now()
);
create index if not exists serials_owner_idx on public.global_card_serials(owner_id);
create index if not exists serials_car_idx on public.global_card_serials(car_id, id);

create table if not exists public.daily_bosses (
  challenge_date date primary key,
  car_id integer not null check (car_id between 0 and 95),
  created_at timestamptz not null default now()
);

create table if not exists public.showdown_results (
  challenge_date date not null references public.daily_bosses(challenge_date),
  user_id uuid not null references auth.users(id) on delete cascade,
  best_score integer not null check (best_score between 0 and 300),
  car_serial_id bigint references public.global_card_serials(id),
  updated_at timestamptz not null default now(),
  primary key(challenge_date, user_id)
);
create index if not exists showdown_rank_idx on public.showdown_results(challenge_date, best_score desc, updated_at asc);

alter table public.profiles enable row level security;
alter table public.global_card_serials enable row level security;
alter table public.daily_bosses enable row level security;
alter table public.showdown_results enable row level security;

drop policy if exists "Profiles readable" on public.profiles;
create policy "Profiles readable" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "Own profile editable" on public.profiles;
create policy "Own profile editable" on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Own serials readable" on public.global_card_serials;
create policy "Own serials readable" on public.global_card_serials
for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Bosses readable" on public.daily_bosses;
create policy "Bosses readable" on public.daily_bosses for select to anon, authenticated using (true);

drop policy if exists "Scores readable" on public.showdown_results;
create policy "Scores readable" on public.showdown_results for select to anon, authenticated using (true);

-- No INSERT/UPDATE/DELETE policies on cards, bosses, or scores.
-- Use server-only credentials from Edge Functions after validation.
-- NEVER expose the Supabase service_role key in index.html or GitHub.
