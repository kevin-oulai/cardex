-- CARDEX titles: server-verified, computed from current inventory, claims and historical Showdown standings.
alter table public.profiles add column if not exists equipped_title text;
create or replace function public.cardex_titles(p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target uuid:=coalesce(p_user_id,auth.uid()); equipped text; result jsonb;
begin
 if uid is null then raise exception 'Sign in required';end if;
 if not exists(select 1 from public.profiles where id=target) then return null;end if;
 select equipped_title into equipped from public.profiles where id=target;
 with ranked as (
   select r.user_id,r.challenge_date,
   row_number() over(partition by r.challenge_date order by
     case when r.best_score=100 and r.first_cleared_at is not null then 0 else 1 end,
     case when r.best_score=100 then r.first_cleared_at end asc nulls last,
     case when r.best_score<100 then r.best_score end desc nulls last,
     r.updated_at asc,r.user_id asc) as place
   from public.showdown_results r
 ),
 measures as (
  select
   (select count(*) from public.achievement_claims where user_id=target)::int achievements,
   (select count(*) from public.global_card_serials where owner_id=target)::int total,
   (select count(*) from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=target and c.rarity='Rare')::int rare_count,
   (select count(*) from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=target and c.rarity in ('Legendary','Exotic','Limited'))::int legendary_count,
   (select count(distinct s.car_id) from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=target and c.country='Japan')::int jdm_count,
   (select count(distinct s.car_id) from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=target and c.country in ('Germany','Italy','France','UK'))::int europe_count,
   (select count(distinct s.car_id) from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=target and c.motorsport)::int motorsport_count,
   (select count(*) from ranked where user_id=target and place<=3)::int podiums,
   (select count(*) from ranked where user_id=target and place=1)::int victories,
   (select count(*) from public.showdown_results where user_id=target)::int showdowns
 ),
 definitions(id,label,description,category,progress,goal) as (
  select * from (values
   ('rookie','Rookie Collector','Own 1 card','Collection',(select total from measures),1),
   ('archivist','The Archivist','Own 100 cards','Collection',(select total from measures),100),
   ('rare_hunter','Rare Hunter','Own 10 Rare cards','Rarity',(select rare_count from measures),10),
   ('legend_keeper','Legend Keeper','Own 3 Legendary, Exotic or Limited cards','Rarity',(select legendary_count from measures),3),
   ('mythic_curator','Mythic Curator','Own 10 Legendary, Exotic or Limited cards','Rarity',(select legendary_count from measures),10),
   ('jdm_enthusiast','JDM Enthusiast','Collect 8 different Japanese models','Theme',(select jdm_count from measures),8),
   ('euro_connoisseur','Euro Connoisseur','Collect 8 different European models','Theme',(select europe_count from measures),8),
   ('track_rat','Track Rat','Collect 5 different motorsport models','Theme',(select motorsport_count from measures),5),
   ('achiever','Achievement Hunter','Claim 3 achievements','Achievements',(select achievements from measures),3),
   ('completionist','Completionist','Claim all 5 achievements','Achievements',(select achievements from measures),5),
   ('contender','Showdown Contender','Enter 10 daily Showdowns','Showdown',(select showdowns from measures),10),
   ('podium_finisher','Podium Finisher','Finish in the daily top 3 once','Showdown',(select podiums from measures),1),
   ('podium_regular','Podium Regular','Finish in the daily top 3 five times','Showdown',(select podiums from measures),5),
   ('champion','Showdown Champion','Finish daily rank #1 once','Showdown',(select victories from measures),1),
   ('dynasty','The Dynasty','Finish daily rank #1 five times','Showdown',(select victories from measures),5)
  ) v(id,label,description,category,progress,goal)
 )
 select jsonb_build_object('equipped',equipped,'titles',coalesce(jsonb_agg(jsonb_build_object(
 'id',id,'label',label,'description',description,'category',category,
 'progress',least(progress,goal),'goal',goal,'unlocked',progress>=goal,'equipped',equipped=id
 ) order by category,id),'[]'::jsonb)) into result from definitions;
 return result;
end;$$;
revoke all on function public.cardex_titles(uuid) from public,anon;
grant execute on function public.cardex_titles(uuid) to authenticated;

create or replace function public.cardex_equip_title(p_title text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); info jsonb;
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_title is not null then
  info:=public.cardex_titles(uid);
  if not exists(select 1 from jsonb_array_elements(info->'titles') t where t->>'id'=p_title and (t->>'unlocked')::boolean)
  then raise exception 'Title is locked or unknown';end if;
 end if;
 update public.profiles set equipped_title=p_title where id=uid;
 return public.cardex_titles(uid);
end;$$;
revoke all on function public.cardex_equip_title(text) from public,anon;
grant execute on function public.cardex_equip_title(text) to authenticated;
