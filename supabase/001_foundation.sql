-- CARDEX backend foundation — Supabase PostgreSQL
-- Apply manually in a NEW Supabase project's SQL editor.
-- No client-side INSERT policy is granted for cards, bosses, or scores.
create table if not exists public.car_catalog (
  id integer primary key check (id between 0 and 100000),
  make text not null, model text not null,
  hp integer not null check (hp > 0),
  speed integer not null check (speed > 0),
  weight integer not null check (weight > 0),
  rarity text not null
);
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Collector' check (char_length(display_name) between 1 and 24),
  created_at timestamptz not null default now()
);
create table if not exists public.owned_cards (
  serial bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  car_id integer not null references public.car_catalog(id),
  finish text not null check (finish in ('Standard','Foil','Holographic','Collector')),
  issued_at timestamptz not null default now(),
  recycled_at timestamptz
);
create index if not exists owned_cards_owner_idx on public.owned_cards(owner_id) where recycled_at is null;
create table if not exists public.daily_bosses (
  boss_date date primary key,
  car_id integer not null references public.car_catalog(id),
  created_at timestamptz not null default now()
);
create table if not exists public.showdown_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  boss_date date not null references public.daily_bosses(boss_date),
  best_score integer not null check (best_score between 0 and 100),
  car_id integer not null references public.car_catalog(id),
  updated_at timestamptz not null default now(),
  primary key(user_id,boss_date)
);
create index if not exists showdown_ranking_idx on public.showdown_scores(boss_date,best_score desc,updated_at asc);
alter table public.car_catalog enable row level security;
alter table public.profiles enable row level security;
alter table public.owned_cards enable row level security;
alter table public.daily_bosses enable row level security;
alter table public.showdown_scores enable row level security;
create policy "catalog readable" on public.car_catalog for select to anon,authenticated using (true);
create policy "bosses readable" on public.daily_bosses for select to anon,authenticated using (true);
create policy "profile owner reads" on public.profiles for select to authenticated using (user_id=auth.uid());
create policy "profile owner inserts" on public.profiles for insert to authenticated with check (user_id=auth.uid());
create policy "profile owner updates" on public.profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "cards owner reads" on public.owned_cards for select to authenticated using (owner_id=auth.uid());
create policy "scores readable" on public.showdown_scores for select to anon,authenticated using (true);
-- Scores are computed by the DB from trusted catalog stats and server-issued cards.
-- SECURITY DEFINER deliberately bypasses RLS only for the narrow, validated operation.
create or replace function public.submit_showdown(p_car_serial bigint)
returns table(score integer, best_score integer, boss_date date)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_date date := (now() at time zone 'UTC')::date;
  v_car record;
  v_boss record;
  v_score integer;
  v_best integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select c.hp,c.speed,c.weight,c.id into v_car
  from public.owned_cards oc join public.car_catalog c on c.id=oc.car_id
  where oc.serial=p_car_serial and oc.owner_id=v_user and oc.recycled_at is null;
  if not found then raise exception 'Card not owned'; end if;
  select c.hp,c.speed,c.weight into v_boss
  from public.daily_bosses b join public.car_catalog c on c.id=b.car_id
  where b.boss_date=v_date;
  if not found then raise exception 'Today''s shared boss is not configured'; end if;
  v_score := round((
    least(100,round(100.0*v_car.hp/v_boss.hp)) +
    least(100,round(100.0*v_car.speed/v_boss.speed)) +
    least(100,round(100.0*v_boss.weight/v_car.weight))
  )/3.0);
  insert into public.showdown_scores(user_id,boss_date,best_score,car_id)
  values(v_user,v_date,v_score,v_car.id)
  on conflict(user_id,boss_date) do update
    set best_score=excluded.best_score,car_id=excluded.car_id,updated_at=now()
    where public.showdown_scores.best_score<excluded.best_score;
  select s.best_score into v_best from public.showdown_scores s
  where s.user_id=v_user and s.boss_date=v_date;
  return query select v_score,v_best,v_date;
end $$;
revoke all on function public.submit_showdown(bigint) from public,anon;
grant execute on function public.submit_showdown(bigint) to authenticated;
-- Do not expose the service_role key to the browser.
-- Server-only card issuance and shared boss scheduling are intentionally NOT
-- provided as public client functions. They require trusted server logic.
