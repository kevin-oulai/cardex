-- CARDEX public leaderboard and inspectable collector profiles.
-- Run after backend/model-serials-showdown-rewards.sql.
-- Only curated public-facing data is returned; never expose emails, save JSON,
-- wallet balances, or full serial ownership.
create or replace function public.cardex_daily_leaderboard(p_day date default ((now() at time zone 'UTC')::date))
returns table(user_id uuid, display_name text, best_score integer,
  first_cleared_at timestamptz, updated_at timestamptz,
  car_id integer, model_serial bigint, finish text,
  cards_owned bigint, unique_models bigint)
language sql stable security definer set search_path='' as $$
select r.user_id,coalesce(p.display_name,'Collector')::text,r.best_score,
 r.first_cleared_at,r.updated_at,s.car_id,s.model_serial,s.finish,
 coalesce(t.cards_owned,0),coalesce(t.unique_models,0)
from public.showdown_results r
left join public.profiles p on p.id=r.user_id
left join public.global_card_serials s on s.id=r.car_serial_id and s.owner_id=r.user_id
left join lateral (
 select count(*)::bigint as cards_owned,count(distinct car_id)::bigint as unique_models
 from public.global_card_serials x where x.owner_id=r.user_id
) t on true
where r.challenge_date=p_day
order by case when r.best_score=100 and r.first_cleared_at is not null then 0 else 1 end,
 case when r.best_score=100 then r.first_cleared_at end asc nulls last,
 case when r.best_score<100 then r.best_score end desc nulls last,
 r.updated_at asc,r.user_id asc
limit 100;
$$;
revoke all on function public.cardex_daily_leaderboard(date) from public,anon;
grant execute on function public.cardex_daily_leaderboard(date) to authenticated;

create or replace function public.cardex_public_collector(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_name text; v_joined timestamptz; v_cards bigint; v_models bigint;
 v_rare bigint; v_top jsonb; v_bests jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select display_name,created_at into v_name,v_joined from public.profiles where id=p_user_id;
 if not found then return null;end if;
 select count(*),count(distinct car_id),count(*) filter(where c.rarity in ('Legendary','Exotic','Limited'))
 into v_cards,v_models,v_rare
 from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id
 where s.owner_id=p_user_id;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_top
 from (select s.car_id,s.model_serial,s.finish,c.rarity
       from public.global_card_serials s
       join public.vehicle_catalog c on c.id=s.car_id
       where s.owner_id=p_user_id
       order by case c.rarity when 'Limited' then 8 when 'Exotic' then 7
         when 'Legendary' then 6 when 'Ultra Rare' then 5 when 'Super Rare' then 4
         when 'Rare' then 3 when 'Uncommon' then 2 else 1 end desc,
         s.id asc limit 3) x;
 select coalesce(jsonb_agg(to_jsonb(y)),'[]'::jsonb) into v_bests
 from (select challenge_date,best_score,first_cleared_at from public.showdown_results
       where user_id=p_user_id order by challenge_date desc limit 5) y;
 return jsonb_build_object('id',p_user_id,'display_name',v_name,'joined_at',v_joined,
  'cards_owned',v_cards,'unique_models',v_models,'high_tier_cards',v_rare,
  'featured_cards',v_top,'recent_showdowns',v_bests);
end;$$;
revoke all on function public.cardex_public_collector(uuid) from public,anon;
grant execute on function public.cardex_public_collector(uuid) to authenticated;
