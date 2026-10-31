create or replace function public.cardex_claim_achievement(p_id integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); w public.player_wallets%rowtype; eligible boolean:=false; prize integer;
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_id not between 0 and 9 then raise exception 'Unknown achievement';end if;
 perform public.cardex_wallet_refill(uid);
 select * into w from public.player_wallets where user_id=uid for update;
 case p_id
 when 0 then eligible:=w.opened>=1;prize:=100;
 when 1 then eligible:=(select count(distinct car_id)>=10 from public.global_card_serials where owner_id=uid);prize:=150;
 when 2 then eligible:=(select count(distinct car_id)>=20 from public.global_card_serials where owner_id=uid);prize:=300;
 when 3 then eligible:=w.opened>=25;prize:=400;
 when 4 then eligible:=exists(select 1 from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=uid and c.rarity='Legendary');prize:=500;
 when 5 then eligible:=w.opened>=50;prize:=650;
 when 6 then eligible:=(select count(distinct car_id)>=50 from public.global_card_serials where owner_id=uid);prize:=750;
 when 7 then eligible:=(select count(distinct s.car_id)>=12 from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=uid and c.country='Japan');prize:=600;
 when 8 then eligible:=(select count(*)>=15 from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=uid and c.rarity in ('Rare','Super Rare','Ultra Rare','Legendary','Exotic','Limited'));prize:=700;
 when 9 then eligible:=(select count(*)>=3 from public.global_card_serials s join public.vehicle_catalog c on c.id=s.car_id where s.owner_id=uid and c.rarity in ('Legendary','Exotic','Limited'));prize:=900;
 end case;
 if not eligible then raise exception 'Achievement requirements not met';end if;
 insert into public.achievement_claims(user_id,achievement_id) values(uid,p_id) on conflict do nothing;
 if not found then raise exception 'Achievement already claimed';end if;
 update public.player_wallets set credits=credits+prize where user_id=uid returning * into w;
 return jsonb_build_object('id',p_id,'credits',prize,'wallet',to_jsonb(w));
end;$$;
revoke all on function public.cardex_claim_achievement(integer) from public,anon;
grant execute on function public.cardex_claim_achievement(integer) to authenticated;