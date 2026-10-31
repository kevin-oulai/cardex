create or replace function public.cardex_market_create(p_serial_id bigint,p_price integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); own uuid; n bigint;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if p_price is null or p_price<10 or p_price>10000000 then raise exception 'Price must be between 10 and 10,000,000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cardex-market-list:'||u::text,0));
 select owner_id into own from public.global_card_serials where id=p_serial_id for update;
 if own is distinct from u then raise exception 'Card not owned by you'; end if;
 if (select count(*) from public.cardex_market_listings where seller_id=u and status='active')>=10 then raise exception 'Maximum 10 active listings'; end if;
 insert into public.cardex_market_listings(serial_id,seller_id,price) values(p_serial_id,u,p_price) returning id into n;
 return jsonb_build_object('id',n);
end $$;
revoke all on function public.cardex_market_create(bigint,integer) from public,anon;
grant execute on function public.cardex_market_create(bigint,integer) to authenticated;