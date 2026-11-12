-- CARDEX — progression rework (Nov 2026): 33 achievements and 27 titles in five prestige tiers.
-- Old titles counted total cards (recycling lost them), "Completionist" said 5 achievements when there were 10,
-- and podium/victory titles counted the current, unfinished UTC day. Everything is now driven by one measure set.

-- Every number progression can depend on, for one player. Internal: not callable by clients.
create or replace function public.cardex_measures(p_user uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
with owned as (
  select s.car_id, s.finish, c.rarity, c.country, c.motorsport
  from public.global_card_serials s join public.vehicle_catalog c on c.id = s.car_id
  where s.owner_id = p_user),
models as (select distinct car_id, rarity, country, motorsport from owned),
closed as (  -- only finished UTC days count for placements
  select r.user_id, row_number() over (partition by r.challenge_date order by
    case when r.best_score = 100 and r.first_cleared_at is not null then 0 else 1 end,
    r.first_cleared_at asc nulls last, r.best_score desc, r.updated_at asc, r.user_id) as place
  from public.showdown_results r
  where r.challenge_date < (now() at time zone 'UTC')::date),
w as (select coalesce(max(opened), 0) opened, coalesce(max(xp), 0) xp from public.player_wallets where user_id = p_user)
select jsonb_build_object(
  'opened', (select opened from w),
  'xp', (select xp from w),
  'level', floor(sqrt((select xp from w) / 120.0))::int + 1,
  'cards', (select count(*) from owned),
  'models', (select count(*) from models),
  'jdm', (select count(*) from models where country = 'Japan'),
  'german', (select count(*) from models where country = 'Germany'),
  'italian', (select count(*) from models where country = 'Italy'),
  'british', (select count(*) from models where country = 'UK'),
  'american', (select count(*) from models where country = 'USA'),
  'european', (select count(*) from models where country in ('Germany', 'Italy', 'France', 'UK')),
  'motorsport', (select count(*) from models where motorsport),
  'superplus', (select count(*) from owned where rarity in ('Super Rare', 'Ultra Rare', 'Legendary', 'Exotic', 'Limited')),
  'legendary', (select count(*) from owned where rarity = 'Legendary'),
  'exotic', (select count(*) from owned where rarity = 'Exotic'),
  'limited', (select count(*) from owned where rarity = 'Limited'),
  'legendplus', (select count(*) from owned where rarity in ('Legendary', 'Exotic', 'Limited')),
  'foil', (select count(*) from owned where finish = 'Foil'),
  'holo', (select count(*) from owned where finish = 'Holographic'),
  'collector', (select count(*) from owned where finish = 'Collector'),
  'showdowns', (select count(*) from public.showdown_results where user_id = p_user),
  'perfect', (select count(*) from public.showdown_results where user_id = p_user and best_score = 100),
  'podiums', (select count(*) from closed where user_id = p_user and place <= 3),
  'wins', (select count(*) from closed where user_id = p_user and place = 1),
  'trades', (select count(*) from public.cardex_market_listings where status = 'sold' and (seller_id = p_user or buyer_id = p_user)),
  'friends', (select count(*) from public.cardex_friend_requests where status = 'accepted' and (sender_id = p_user or recipient_id = p_user)),
  'showroom', (select case when exists (
      select 1 from public.player_saves ps, jsonb_array_elements(case when jsonb_typeof(ps.state->'collector'->'showcase') = 'array' then ps.state->'collector'->'showcase' else '[]'::jsonb end) e
      where ps.user_id = p_user and jsonb_typeof(e) = 'number') then 1 else 0 end),
  'achievements', (select count(*) from public.achievement_claims where user_id = p_user)
);
$$;

create or replace function public.cardex_achievement_defs()
returns table(id int, key text, name text, description text, category text, measure text, goal int, credits int)
language sql immutable set search_path to '' as $$
values
 (0,'first_ignition','First Ignition','Open your first booster','Boosters','opened',1,100),
 (1,'pack_rat','Pack Rat','Open 10 boosters','Boosters','opened',10,250),
 (2,'road_trip','Road Trip','Open 50 boosters','Boosters','opened',50,700),
 (3,'long_haul','Long Haul','Open 150 boosters','Boosters','opened',150,1800),
 (4,'million_mile','Million-Mile Club','Open 400 boosters','Boosters','opened',400,5000),
 (5,'getting_started','Getting Started','Discover 10 different models','Cardex','models',10,150),
 (6,'collector','Collector','Discover 30 different models','Cardex','models',30,400),
 (7,'curator','Curator','Discover 60 different models','Cardex','models',60,1000),
 (8,'archivist','Archivist','Discover 100 different models','Cardex','models',100,2500),
 (9,'encyclopedia','Encyclopedia','Discover 140 different models','Cardex','models',140,5000),
 (10,'full_cardex','Full Cardex','Discover all 174 models','Cardex','models',174,15000),
 (11,'shiny_find','Shiny Find','Own a Super Rare or better','Rarity','superplus',1,150),
 (12,'legendary_encounter','Legendary Encounter','Own a Legendary card','Rarity','legendary',1,500),
 (13,'exotic_taste','Exotic Taste','Own an Exotic card','Rarity','exotic',1,800),
 (14,'limited_edition','Limited Edition','Own a Limited card','Rarity','limited',1,1500),
 (15,'supercar_royalty','Supercar Royalty','Own 10 Legendary, Exotic or Limited cards','Rarity','legendplus',10,2000),
 (16,'foiled_again','Foiled Again','Own a Foil card','Finishes','foil',1,100),
 (17,'rainbow_road','Rainbow Road','Own a Holographic card','Finishes','holo',1,400),
 (18,'gold_standard','Gold Standard','Own a Collector-finish card','Finishes','collector',1,2500),
 (19,'jdm_specialist','JDM Specialist','Discover 20 Japanese models','Regions','jdm',20,800),
 (20,'autobahn','Autobahn','Discover 20 German models','Regions','german',20,800),
 (21,'dolce_velocita','Dolce Velocità','Discover 15 Italian models','Regions','italian',15,800),
 (22,'best_of_british','Best of British','Discover 12 British models','Regions','british',12,800),
 (23,'stars_and_stripes','Stars & Stripes','Discover all 9 American models','Regions','american',9,1000),
 (24,'homologation_special','Homologation Special','Discover all 12 motorsport models','Regions','motorsport',12,1500),
 (25,'lights_out','Lights Out','Enter your first Showdown','Showdown','showdowns',1,100),
 (26,'flawless','Flawless','Score 100% in a Showdown','Showdown','perfect',1,300),
 (27,'daily_driver','Daily Driver','Enter 10 daily Showdowns','Showdown','showdowns',10,800),
 (28,'podium','Podium','Finish a day in the top 3','Showdown','podiums',1,600),
 (29,'chequered_flag','Chequered Flag','Finish a day in 1st place','Showdown','wins',1,1500),
 (30,'first_deal','First Deal','Buy or sell a card on the Market','Community','trades',1,200),
 (31,'pit_crew','Pit Crew','Add a friend','Community','friends',1,150),
 (32,'show_off','Show Off','Put a car in your showroom','Community','showroom',1,100)
$$;

create or replace function public.cardex_title_defs()
returns table(id text, label text, description text, category text, measure text, goal int, tier text)
language sql immutable set search_path to '' as $$
values
 ('rookie','Rookie','Open your first booster','Boosters','opened',1,'standard'),
 ('weekend_warrior','Weekend Warrior','Discover 15 models','Collection','models',15,'standard'),
 ('first_trophy','Trophy Hunter','Claim 5 achievements','Achievements','achievements',5,'standard'),
 ('jdm_enthusiast','JDM Enthusiast','Discover 12 Japanese models','Regions','jdm',12,'epic'),
 ('euro_connoisseur','Euro Connoisseur','Discover 30 European models','Regions','european',30,'epic'),
 ('track_rat','Track Rat','Discover 6 motorsport models','Regions','motorsport',6,'epic'),
 ('shiny_hunter','Shiny Hunter','Own a Holographic card','Rarity','holo',1,'epic'),
 ('daily_driver','Daily Driver','Enter 10 daily Showdowns','Showdown','showdowns',10,'epic'),
 ('rising_star','Rising Star','Reach level 5','Level','level',5,'epic'),
 ('wheeler_dealer','Wheeler-Dealer','Complete 5 Market trades','Market','trades',5,'epic'),
 ('the_curator','The Curator','Discover 75 models','Collection','models',75,'legendary'),
 ('legend_keeper','Legend Keeper','Own 5 Legendary, Exotic or Limited cards','Rarity','legendplus',5,'legendary'),
 ('collectors_eye','Collector''s Eye','Own a Collector-finish card','Rarity','collector',1,'legendary'),
 ('jdm_master','JDM Master','Discover all 42 Japanese models','Regions','jdm',42,'legendary'),
 ('motorsport_historian','Motorsport Historian','Discover all 12 motorsport models','Regions','motorsport',12,'legendary'),
 ('podium_finisher','Podium Finisher','Finish 3 days in the top 3','Showdown','podiums',3,'legendary'),
 ('champion','Champion','Finish a day in 1st place','Showdown','wins',1,'legendary'),
 ('road_warrior','Road Warrior','Reach level 15','Level','level',15,'legendary'),
 ('market_mogul','Market Mogul','Complete 25 Market trades','Market','trades',25,'legendary'),
 ('mythic_curator','Mythic Curator','Own 15 Legendary, Exotic or Limited cards','Rarity','legendplus',15,'mythic'),
 ('dynasty','The Dynasty','Finish 5 days in 1st place','Showdown','wins',5,'mythic'),
 ('veteran','Veteran','Reach level 25','Level','level',25,'mythic'),
 ('trophy_cabinet','Trophy Cabinet','Claim 25 achievements','Achievements','achievements',25,'mythic'),
 ('grand_completionist','Grand Completionist','Discover all 174 models','Collection','models',174,'ascendant'),
 ('the_undisputed','The Undisputed','Finish 15 days in 1st place','Showdown','wins',15,'ascendant'),
 ('eternal_racer','Eternal Racer','Reach level 40','Level','level',40,'ascendant'),
 ('achievement_master','Achievement Master','Claim all 33 achievements','Achievements','achievements',33,'ascendant')
$$;

create or replace function public.cardex_achievements()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare uid uuid := auth.uid(); m jsonb;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 m := public.cardex_measures(uid);
 return (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'key', d.key, 'name', d.name, 'description', d.description,
   'category', d.category, 'goal', d.goal, 'credits', d.credits,
   'progress', least((m->>d.measure)::int, d.goal),
   'claimed', exists(select 1 from public.achievement_claims c where c.user_id = uid and c.achievement_id = d.id)) order by d.id), '[]'::jsonb)
  from public.cardex_achievement_defs() d);
end $$;

create or replace function public.cardex_claim_achievement(p_id integer)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid(); d record; w public.player_wallets%rowtype; m jsonb;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 select * into d from public.cardex_achievement_defs() x where x.id = p_id;
 if not found then raise exception 'Unknown achievement'; end if;
 perform public.cardex_wallet_refill(uid);
 select * into w from public.player_wallets where user_id = uid for update;
 m := public.cardex_measures(uid);
 if coalesce((m->>d.measure)::int, 0) < d.goal then raise exception 'Not unlocked yet: %', d.description; end if;
 insert into public.achievement_claims(user_id, achievement_id) values (uid, p_id) on conflict do nothing;
 if not found then raise exception 'Already claimed'; end if;
 update public.player_wallets set credits = credits + d.credits where user_id = uid returning * into w;
 return jsonb_build_object('id', p_id, 'name', d.name, 'credits', d.credits, 'wallet', to_jsonb(w));
end $$;

create or replace function public.cardex_titles(p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare uid uuid := auth.uid(); target uuid := coalesce(p_user_id, auth.uid()); eq text; m jsonb;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.profiles where id = target) then return null; end if;
 select equipped_title into eq from public.profiles where id = target;
 -- Other players only see the equipped title, never progress, when the collection is private.
 if target <> uid and not exists(select 1 from public.profiles where id = target and public_collection) then
  return (select jsonb_build_object('equipped', eq, 'titles', coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'label', d.label, 'tier', d.tier, 'unlocked', true, 'equipped', true)), '[]'::jsonb))
          from public.cardex_title_defs() d where d.id = eq);
 end if;
 m := public.cardex_measures(target);
 return (select jsonb_build_object('equipped', eq, 'titles', coalesce(jsonb_agg(jsonb_build_object(
   'id', d.id, 'label', d.label, 'description', d.description, 'category', d.category, 'tier', d.tier,
   'progress', least((m->>d.measure)::int, d.goal), 'goal', d.goal,
   'unlocked', (m->>d.measure)::int >= d.goal, 'equipped', d.id = eq) order by array_position(array['standard','epic','legendary','mythic','ascendant'], d.tier), d.goal), '[]'::jsonb))
  from public.cardex_title_defs() d);
end $$;

alter table public.achievement_claims drop constraint if exists achievement_claims_achievement_id_check;
alter table public.achievement_claims add constraint achievement_claims_achievement_id_check check (achievement_id between 0 and 63);
update public.profiles set equipped_title = null where equipped_title is not null and equipped_title not in (select id from public.cardex_title_defs());

revoke execute on function public.cardex_measures(uuid) from public, anon, authenticated;
revoke execute on function public.cardex_achievement_defs() from public, anon;
revoke execute on function public.cardex_title_defs() from public, anon;
grant execute on function public.cardex_achievement_defs() to authenticated;
grant execute on function public.cardex_title_defs() to authenticated;
revoke execute on function public.cardex_achievements() from public, anon;
grant execute on function public.cardex_achievements() to authenticated;
