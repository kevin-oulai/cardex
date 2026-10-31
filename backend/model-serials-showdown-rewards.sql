-- CARDEX model-scoped serials and transactional Showdown milestone rewards.
-- Run AFTER backend/verified-showdown.sql and backend/authoritative-game.sql.
-- Existing global_card_serials.id remains the immutable internal identity.
-- Per-model serials are assigned in issuance order (id ASC), including old cards.
-- A serial is unique within each model across ALL accounts, regardless of finish.

alter table public.global_card_serials
  add column if not exists model_serial bigint;

create table if not exists public.model_serial_counters (
  car_id integer primary key references public.vehicle_catalog(id),
  last_serial bigint not null default 0 check (last_serial>=0)
);
alter table public.model_serial_counters enable row level security;
-- No client policies: only trusted SECURITY DEFINER functions update counters.

-- Lock issuance while migrating, so existing cards and counters are consistent.
begin;
lock table public.global_card_serials in access exclusive mode;
with numbered as (
  select id, row_number() over(partition by car_id order by id) as n
  from public.global_card_serials
)
update public.global_card_serials s
set model_serial=n.n from numbered n where s.id=n.id
  and s.model_serial is distinct from n.n;

insert into public.model_serial_counters(car_id,last_serial)
select c.id,coalesce(max(s.model_serial),0)
from public.vehicle_catalog c
left join public.global_card_serials s on s.car_id=c.id
group by c.id
on conflict(car_id) do update set last_serial=greatest(
  public.model_serial_counters.last_serial,excluded.last_serial);
commit;

alter table public.global_card_serials
  alter column model_serial set not null;
create unique index if not exists cardex_model_serial_unique
  on public.global_card_serials(car_id,model_serial);

create or replace function public.cardex_next_model_serial(p_car_id integer)
returns bigint language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
  insert into public.model_serial_counters(car_id,last_serial)
  values(p_car_id,1)
  on conflict(car_id) do update
    set last_serial=public.model_serial_counters.last_serial+1
  returning last_serial into n;
  return n;
end;$$;
revoke all on function public.cardex_next_model_serial(integer) from public,anon,authenticated;

-- Recreate pack RPC with the same issuance rules but model-scoped serials.
create or replace function public.cardex_open_pack(p_theme integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); w public.player_wallets%rowtype;
  j integer; k integer; tier integer; chosen public.vehicle_catalog%rowtype;
  drawn integer[]:='{}'; cards jsonb:='[]'::jsonb; r double precision;
  finish text; internal_id bigint; model_no bigint; got_high boolean:=false;
  tiers text[]:=array['Common','Uncommon','Rare','Super Rare','Ultra Rare','Legendary','Exotic','Limited'];
  weights numeric[]:=array[44.6,26.8,15.9,8,3.5,0.5,0.5,0.2];
begin
 if uid is null then raise exception 'Authentication required';end if;
 if p_theme not between 0 and 3 then raise exception 'Invalid booster theme';end if;
 perform public.cardex_wallet_refill(uid);
 select * into w from public.player_wallets where user_id=uid for update;
 if w.tickets<1 then raise exception 'Not enough tickets';end if;
 for j in 1..5 loop
   if j=5 and w.pity>=59 then tier:=6;
   else
     r:=random()*100; tier:=1;
     for k in 1..8 loop
       r:=r-weights[k];
       if r<0 then tier:=k;exit;end if;
     end loop;
     if j=5 then tier:=greatest(3,tier);end if;
   end if;
   select * into chosen from public.vehicle_catalog c
   where c.id<>all(drawn)
     and (p_theme=0 or (p_theme=1 and c.country='Japan') or
       (p_theme=2 and c.country in ('Germany','France','Italy','UK')) or
       (p_theme=3 and (c.motorsport or c.rarity in ('Legendary','Exotic','Limited'))))
   order by abs(array_position(tiers,c.rarity)-tier),random() limit 1;
   if not found then raise exception 'Empty booster pool';end if;
   drawn:=array_append(drawn,chosen.id);
   r:=random();
   finish:=case when r<0.002 then 'Collector' when r<0.027 then 'Holographic'
                when r<0.147 then 'Foil' else 'Standard' end;
   model_no:=public.cardex_next_model_serial(chosen.id);
   insert into public.global_card_serials(car_id,finish,owner_id,model_serial)
     values(chosen.id,finish,uid,model_no) returning id into internal_id;
   cards:=cards||jsonb_build_array(jsonb_build_object('id',chosen.id,
     'finish',finish,'serial',model_no,'issuance_id',internal_id));
   if chosen.rarity in ('Legendary','Exotic','Limited') then got_high:=true;end if;
 end loop;
 update public.player_wallets set tickets=tickets-1,opened=opened+1,xp=xp+50,
   pity=case when got_high then 0 else pity+1 end where user_id=uid;
 return jsonb_build_object('cards',cards,'wallet',
   (select to_jsonb(x) from public.player_wallets x where x.user_id=uid));
end;$$;
revoke all on function public.cardex_open_pack(integer) from public,anon;
grant execute on function public.cardex_open_pack(integer) to authenticated;

create table if not exists public.showdown_reward_claims (
  challenge_date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_index integer not null check(milestone_index between 0 and 4),
  claimed_at timestamptz not null default now(),
  primary key(challenge_date,user_id,milestone_index)
);
alter table public.showdown_reward_claims enable row level security;
drop policy if exists "Read own showdown claims" on public.showdown_reward_claims;
create policy "Read own showdown claims" on public.showdown_reward_claims
  for select to authenticated using(user_id=(select auth.uid()));
-- No direct client writes; claims are granted only inside score submission transaction.

-- Reward table matches the frontend milestone thresholds and prizes.
-- Replace these values if the frontend milestones change.
create or replace function public.cardex_showdown_reward(p_index integer)
returns jsonb language sql immutable set search_path='' as $$
select case p_index
 when 0 then jsonb_build_object('at',20,'credits',50,'tickets',0)
 when 1 then jsonb_build_object('at',40,'credits',100,'tickets',0)
 when 2 then jsonb_build_object('at',60,'credits',150,'tickets',1)
 when 3 then jsonb_build_object('at',80,'credits',250,'tickets',1)
 when 4 then jsonb_build_object('at',100,'credits',500,'tickets',2)
 else null end;
$$;
revoke all on function public.cardex_showdown_reward(integer) from public,anon,authenticated;

create or replace function public.cardex_submit_showdown(p_serial_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'UTC')::date;
  boss public.vehicle_catalog%rowtype; challenger public.vehicle_catalog%rowtype;
  result public.showdown_results%rowtype; score integer;
  power_score integer; speed_score integer; weight_score integer;
  i integer; prize jsonb; awarded_credits integer:=0; awarded_tickets integer:=0;
  new_claims integer[]:='{}'; wallet public.player_wallets%rowtype;
begin
 if uid is null then raise exception 'Sign in required';end if;
 perform public.cardex_publish_boss();
 select c.* into boss from public.daily_bosses b
 join public.vehicle_catalog c on c.id=b.car_id where b.challenge_date=d;
 if not found then raise exception 'No daily boss available';end if;
 select c.* into challenger from public.global_card_serials s
 join public.vehicle_catalog c on c.id=s.car_id
 where s.id=p_serial_id and s.owner_id=uid;
 if not found then raise exception 'This card is not in your online collection';end if;
 power_score:=least(100,greatest(0,round(100.0*challenger.hp/greatest(1,boss.hp))::integer));
 speed_score:=least(100,greatest(0,round(100.0*challenger.speed/greatest(1,boss.speed))::integer));
 weight_score:=least(100,greatest(0,round(100.0*boss.weight/greatest(1,challenger.weight))::integer));
 score:=round((power_score+speed_score+weight_score)/3.0)::integer;

 -- Serialize all submissions for this user and UTC day to avoid double rewards.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(uid::text||':'||d::text,0));
 insert into public.showdown_results(challenge_date,user_id,best_score,car_serial_id,first_cleared_at)
 values(d,uid,score,p_serial_id,case when score=100 then now() else null end)
 on conflict(challenge_date,user_id) do update
 set best_score=greatest(public.showdown_results.best_score,excluded.best_score),
 car_serial_id=case when excluded.best_score>public.showdown_results.best_score
   then excluded.car_serial_id else public.showdown_results.car_serial_id end,
 updated_at=case when excluded.best_score>public.showdown_results.best_score
   then now() else public.showdown_results.updated_at end,
 first_cleared_at=coalesce(public.showdown_results.first_cleared_at,excluded.first_cleared_at)
 returning * into result;
 perform public.cardex_wallet_refill(uid);
 for i in 0..4 loop
   prize:=public.cardex_showdown_reward(i);
   if result.best_score >= (prize->>'at')::integer then
     insert into public.showdown_reward_claims(challenge_date,user_id,milestone_index)
     values(d,uid,i) on conflict do nothing;
     if found then
       new_claims:=array_append(new_claims,i);
       awarded_credits:=awarded_credits+(prize->>'credits')::integer;
       awarded_tickets:=awarded_tickets+(prize->>'tickets')::integer;
     end if;
   end if;
 end loop;
 update public.player_wallets set credits=credits+awarded_credits,
   tickets=least(100,tickets+awarded_tickets)
 where user_id=uid returning * into wallet;
 return jsonb_build_object('score',score,'best',result.best_score,
   'first_cleared_at',result.first_cleared_at,'challenge_date',d,
   'claimed',(select coalesce(jsonb_agg(milestone_index order by milestone_index),'[]'::jsonb)
     from public.showdown_reward_claims where challenge_date=d and user_id=uid),
   'new_claims',to_jsonb(new_claims),'awarded_credits',awarded_credits,
   'awarded_tickets',awarded_tickets,'wallet',to_jsonb(wallet));
end;$$;
revoke all on function public.cardex_submit_showdown(bigint) from public,anon;
grant execute on function public.cardex_submit_showdown(bigint) to authenticated;

create or replace function public.cardex_get_showdown_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'UTC')::date;
begin
 if uid is null then raise exception 'Sign in required';end if;
 return jsonb_build_object('date',d,
  'best',coalesce((select best_score from public.showdown_results
    where challenge_date=d and user_id=uid),0),
  'claimed',(select coalesce(jsonb_agg(milestone_index order by milestone_index),'[]'::jsonb)
    from public.showdown_reward_claims where challenge_date=d and user_id=uid));
end;$$;
revoke all on function public.cardex_get_showdown_status() from public,anon;
grant execute on function public.cardex_get_showdown_status() to authenticated;
