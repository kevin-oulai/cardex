-- CARDEX — November 2026 audit fixes. Idempotent; safe to re-run.
-- 1. Recycling: per-model recycling rejected every car id above 95 (catalog has 192),
--    and a duplicate listed on the market aborted the whole batch via the market guard trigger.
--    Kept copy is now chosen deliberately: prefer a card that is NOT listed and IS referenced by
--    Showdown history, so the copy you keep is the one that can't be sold away or deleted.
create or replace function public.cardex_recycle_duplicates(p_car_id integer default null, p_finish text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid:=auth.uid(); reward integer:=0; n integer:=0; w public.player_wallets%rowtype; rec record;
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_car_id is not null and not exists(select 1 from public.vehicle_catalog where id=p_car_id) then raise exception 'Invalid car';end if;
 if p_finish is not null and p_finish not in ('Standard','Foil','Holographic','Collector') then raise exception 'Invalid finish';end if;
 perform public.cardex_wallet_refill(uid);
 select * into w from public.player_wallets where user_id=uid for update;
 for rec in
  select z.id,z.rarity from (
   select s.id,s.car_id,s.finish,c.rarity,
    exists(select 1 from public.cardex_market_listings l where l.serial_id=s.id and l.status='active') as listed,
    exists(select 1 from public.showdown_results r where r.car_serial_id=s.id) as historic,
    row_number() over(partition by s.car_id,s.finish order by
      exists(select 1 from public.cardex_market_listings l where l.serial_id=s.id and l.status='active') asc,
      exists(select 1 from public.showdown_results r where r.car_serial_id=s.id) desc,
      s.id) as position
   from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id
   where s.owner_id=uid
  ) z
  where z.position>1 and not z.listed and not z.historic
   and (p_car_id is null or z.car_id=p_car_id) and (p_finish is null or z.finish=p_finish)
 loop
  delete from public.global_card_serials where id=rec.id and owner_id=uid;
  if found then
   n:=n+1;
   reward:=reward+(case rec.rarity when 'Common' then 10 when 'Uncommon' then 20 when 'Rare' then 35
    when 'Super Rare' then 60 when 'Ultra Rare' then 100 when 'Legendary' then 200 when 'Exotic' then 300
    when 'Limited' then 500 else 10 end);
  end if;
 end loop;
 update public.player_wallets set credits=credits+reward where user_id=uid returning * into w;
 return jsonb_build_object('count',n,'credits',reward,'wallet',to_jsonb(w));
end;$function$;

-- 2. Pity: JDM boosters contain no Legendary+ cars, so the counter never reset there and
--    every JDM pack after #59 silently forced the closest tier forever. A forced draw now consumes pity.
do $$
declare def text;
begin
 select pg_get_functiondef('public.cardex_open_pack(integer)'::regprocedure) into def;
 if position('got_high or w.pity>=59' in def)=0 then
  def:=replace(def,'pity=case when got_high then 0 else pity+1 end','pity=case when got_high or w.pity>=59 then 0 else pity+1 end');
  if position('got_high or w.pity>=59' in def)=0 then raise exception 'cardex_open_pack pity expression not found';end if;
  execute def;
 end if;
end $$;

-- 3. Public profiles: avatar, bio, theme and the chosen showroom were saved but never shown to
--    anyone — public profiles always rendered a hard-coded avatar and "top 3 by rarity".
--    Values come from user-controlled JSON, so they are whitelisted / length-capped / ownership-checked.
create or replace function public.cardex_public_collector(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_name text;v_joined timestamptz;v_public boolean;v_title text;
 v_cards bigint;v_models bigint;v_rare bigint;v_top jsonb;v_bests jsonb;
 prefs jsonb; v_avatar text; v_bio text; v_theme text; v_show jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select display_name,created_at,public_collection into v_name,v_joined,v_public from public.profiles where id=p_user_id;
 if not found then return null;end if;
 select s.state->'collector' into prefs from public.player_saves s where s.user_id=p_user_id;
 v_avatar:=case when prefs->>'avatar' in ('🏎️','🏁','🔧','🚗','⚡','🏆','🔥','🛞') then prefs->>'avatar' else '🏎️' end;
 v_bio:=left(regexp_replace(coalesce(prefs->>'bio',''),'[[:cntrl:]]','','g'),90);
 v_theme:=case when prefs->>'theme' in ('heritage','ember','midnight','circuit') then prefs->>'theme' else 'heritage' end;
 if not v_public and auth.uid()<>p_user_id then
  return jsonb_build_object('id',p_user_id,'display_name',v_name,'private',true,'avatar',v_avatar,'bio',v_bio,'theme',v_theme);
 end if;
 select count(*),count(distinct car_id),count(*) filter(where c.rarity in ('Legendary','Exotic','Limited'))
  into v_cards,v_models,v_rare
  from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=p_user_id;
 -- Chosen showroom (max 3 distinct owned models, in slot order).
 select coalesce(jsonb_agg(to_jsonb(x) order by x.slot),'[]'::jsonb) into v_show from (
  select distinct on (e.car_id) e.slot, s.car_id, s.model_serial, s.finish, c.rarity
  from (select (v)::text::integer as car_id, o as slot
        from jsonb_array_elements(case when jsonb_typeof(prefs->'showcase')='array' then prefs->'showcase' else '[]'::jsonb end)
        with ordinality as t(v,o) where (v)::text ~ '^[0-9]{1,3}$' and o<=3) e
  join public.global_card_serials s on s.car_id=e.car_id and s.owner_id=p_user_id
  join public.vehicle_catalog c on c.id=s.car_id
  order by e.car_id, case s.finish when 'Collector' then 4 when 'Holographic' then 3 when 'Foil' then 2 else 1 end desc, s.model_serial
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_top from (
  select s.car_id,s.model_serial,s.finish,c.rarity from public.global_card_serials s
  join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=p_user_id
  order by case c.rarity when 'Limited' then 8 when 'Exotic' then 7 when 'Legendary' then 6 when 'Ultra Rare' then 5
   when 'Super Rare' then 4 when 'Rare' then 3 when 'Uncommon' then 2 else 1 end desc,s.id asc limit 3) x;
 select coalesce(jsonb_agg(to_jsonb(y)),'[]'::jsonb) into v_bests from (
  select challenge_date,best_score,first_cleared_at from public.showdown_results
  where user_id=p_user_id order by challenge_date desc limit 5) y;
 return jsonb_build_object('id',p_user_id,'display_name',v_name,'joined_at',v_joined,
  'cards_owned',v_cards,'unique_models',v_models,'high_tier_cards',v_rare,
  'featured_cards',case when jsonb_array_length(v_show)>0 then v_show else v_top end,
  'showroom_chosen',jsonb_array_length(v_show)>0,
  'recent_showdowns',v_bests,'private',false,'avatar',v_avatar,'bio',v_bio,'theme',v_theme);
end;$function$;

-- 4. Profiles: authenticated users could UPDATE every column of their row directly, including
--    equipped_title (bypassing cardex_equip_title's unlock check) and created_at.
revoke insert, update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;
alter table public.profiles drop constraint if exists profiles_display_name_not_blank;
alter table public.profiles add constraint profiles_display_name_not_blank check (btrim(display_name)<>'') not valid;

-- 5. Legacy single-item RPCs are superseded by cardex_open_packs / cardex_buy_tickets.
--    cardex_open_packs keeps calling cardex_open_pack as the function owner.
revoke execute on function public.cardex_open_pack(integer) from authenticated, anon, public;
revoke execute on function public.cardex_buy_ticket() from authenticated, anon, public;

-- 6. Notifications carried no actor name ("sent you a friend request" — from whom?).
do $$
declare def text;
begin
 select pg_get_functiondef('public.cardex_social_list()'::regprocedure) into def;
 if position('actor_name' in def)=0 then
  def:=replace(def,$a$jsonb_build_object('id',n.id,'actor_id',n.actor_id,$a$,$a$jsonb_build_object('id',n.id,'actor_id',n.actor_id,'actor_name',(select ap.display_name from public.profiles ap where ap.id=n.actor_id),$a$);
  if position('actor_name' in def)=0 then raise exception 'pattern not found';end if;
  execute def;
 end if;
end $$;
