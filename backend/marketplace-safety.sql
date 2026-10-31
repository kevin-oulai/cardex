create or replace function public.cardex_market_guard_serial()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.cardex_market_listings l where l.serial_id=old.id and l.status='active') then
   raise exception 'Card is listed on the market; cancel listing first';
 end if;
 return old;
end $$;
drop trigger if exists cardex_market_protect_serial on public.global_card_serials;
create trigger cardex_market_protect_serial before delete or update of owner_id on public.global_card_serials for each row execute function public.cardex_market_guard_serial();
create or replace function public.cardex_market_buy(p_listing_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); l public.cardex_market_listings%rowtype; own uuid; bal integer; cut integer; seller_bal integer;
begin
 if u is null then raise exception 'Sign in required'; end if;
 select * into l from public.cardex_market_listings where id=p_listing_id for update;
 if not found or l.status<>'active' then raise exception 'Listing no longer available'; end if;
 if l.seller_id=u then raise exception 'Cannot buy your own listing'; end if;
 select owner_id into own from public.global_card_serials where id=l.serial_id for update;
 if own is distinct from l.seller_id then raise exception 'Seller no longer owns card'; end if;
 -- Lock wallets in deterministic user-ID order to avoid two-way trade deadlocks.
 perform 1 from public.player_wallets where user_id in (u,l.seller_id) order by user_id for update;
 select credits into bal from public.player_wallets where user_id=u;
 select credits into seller_bal from public.player_wallets where user_id=l.seller_id;
 if bal is null or bal<l.price then raise exception 'Not enough coins'; end if;
 if seller_bal is null then raise exception 'Seller wallet unavailable'; end if;
 cut=(l.price::bigint*5+99)/100;
 if seller_bal::bigint+l.price-cut>2147483647 then raise exception 'Seller wallet limit reached'; end if;
 update public.player_wallets set credits=credits-l.price where user_id=u;
 update public.player_wallets set credits=credits+l.price-cut where user_id=l.seller_id;
 update public.cardex_market_listings set status='sold',buyer_id=u,fee=cut,closed_at=now() where id=l.id;
 update public.global_card_serials set owner_id=u where id=l.serial_id;
 return jsonb_build_object('purchased',true,'serial_id',l.serial_id,'paid',l.price,'fee',cut);
end $$;
revoke all on function public.cardex_market_guard_serial() from public,anon,authenticated;
revoke all on function public.cardex_market_buy(bigint) from public,anon;
grant execute on function public.cardex_market_buy(bigint) to authenticated;