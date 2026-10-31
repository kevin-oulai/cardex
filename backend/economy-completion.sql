-- CARDEX authoritative economy completion: tickets, duplicate recycling, achievements.
-- All mutations are authenticated, transactional, and use only server-owned data.
create table if not exists public.achievement_claims (
 user_id uuid not null references auth.users(id) on delete cascade,
 achievement_id integer not null check(achievement_id between 0 and 4),
 claimed_at timestamptz not null default now(),
 primary key(user_id,achievement_id)
);
alter table public.achievement_claims enable row level security;
drop policy if exists "Own achievement claims readable" on public.achievement_claims;
create policy "Own achievement claims readable" on public.achievement_claims
 for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.cardex_buy_ticket()
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); w public.player_wallets%rowtype;
begin
 if uid is null then raise exception 'Sign in required';end if;
 perform public.cardex_wallet_refill(uid);
 select * into w from public.player_wallets where user_id=uid for update;
 if w.credits<250 then raise exception 'Not enough credits';end if;
 if w.tickets>=100 then raise exception 'Ticket capacity reached';end if;
 update public.player_wallets set credits=credits-250,tickets=tickets+1
 where user_id=uid returning * into w;
 return to_jsonb(w);
end;$$;
revoke all on function public.cardex_buy_ticket() from public,anon;
grant execute on function public.cardex_buy_ticket() to authenticated;

create or replace function public.cardex_recycle_duplicates(p_car_id integer default null,p_finish text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); reward integer:=0; n integer:=0;
 w public.player_wallets%rowtype; rec record;
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_car_id is not null and (p_car_id<0 or p_car_id>95) then raise exception 'Invalid car';end if;
 if p_finish is not null and p_finish not in ('Standard','Foil','Holographic','Collector') then raise exception 'Invalid finish';end if;
 perform public.cardex_wallet_refill(uid);
 select * into w from public.player_wallets where user_id=uid for update;
 -- Serialize recycling and pack issuance for the same wallet.
 for rec in
   select z.id,z.rarity from (
     select s.id,s.car_id,s.finish,c.rarity,
       row_number() over(partition by s.car_id,s.finish order by s.id) as position
     from public.global_card_serials s
     join public.vehicle_catalog c on c.id=s.car_id
     where s.owner_id=uid
   ) z where z.position>1
     and (p_car_id is null or z.car_id=p_car_id)
     and (p_finish is null or z.finish=p_finish)
 loop
   delete from public.global_card_serials where id=rec.id and owner_id=uid;
   if found then
     n:=n+1;
     reward:=reward+(case rec.rarity when 'Common' then 10 when 'Uncommon' then 20
       when 'Rare' then 35 when 'Super Rare' then 60 when 'Ultra Rare' then 100
       when 'Legendary' then 200 when 'Exotic' then 300 when 'Limited' then 500 else 10 end);
   end if;
 end loop;
 update public.player_wallets set credits=credits+reward where user_id=uid returning * into w;
 return jsonb_build_object('count',n,'credits',reward,'wallet',to_jsonb(w));
end;$$;
revoke all on function public.cardex_recycle_duplicates(integer,text) from public,anon;
grant execute on function public.cardex_recycle_duplicates(integer,text) to authenticated;

create or replace function public.cardex_claim_achievement(p_id integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); w public.player_wallets%rowtype;
 eligible boolean:=false; prize integer;
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_id not between 0 and 4 then raise exception 'Unknown achievement';end if;
 perform public.cardex_wallet_refill(uid);
 select * into w from public.player_wallets where user_id=uid for update;
 case p_id
  when 0 then eligible:=w.opened>=1;prize:=100;
  when 1 then eligible:=(select count(distinct car_id)>=10 from public.global_card_serials where owner_id=uid);prize:=150;
  when 2 then eligible:=(select count(distinct car_id)>=20 from public.global_card_serials where owner_id=uid);prize:=300;
  when 3 then eligible:=w.opened>=25;prize:=400;
  when 4 then eligible:=exists(select 1 from public.global_card_serials s
    join public.vehicle_catalog c on c.id=s.car_id
    where s.owner_id=uid and c.rarity='Legendary');prize:=500;
 end case;
 if not eligible then raise exception 'Achievement requirements not met';end if;
 insert into public.achievement_claims(user_id,achievement_id) values(uid,p_id)
 on conflict do nothing;
 if not found then raise exception 'Achievement already claimed';end if;
 update public.player_wallets set credits=credits+prize where user_id=uid returning * into w;
 return jsonb_build_object('id',p_id,'credits',prize,'wallet',to_jsonb(w));
end;$$;
revoke all on function public.cardex_claim_achievement(integer) from public,anon;
grant execute on function public.cardex_claim_achievement(integer) to authenticated;

create or replace function public.cardex_get_achievement_claims()
returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(achievement_id order by achievement_id),'[]'::jsonb)
from public.achievement_claims where user_id=auth.uid();
$$;
revoke all on function public.cardex_get_achievement_claims() from public,anon;
grant execute on function public.cardex_get_achievement_claims() to authenticated;
