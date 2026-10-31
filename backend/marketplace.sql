-- CARDEX fixed-price marketplace: all writes occur in SECURITY DEFINER RPCs.
create table if not exists public.cardex_market_listings(
 id bigint generated always as identity primary key,
 serial_id bigint not null references public.global_card_serials(id) on delete restrict,
 seller_id uuid not null references auth.users(id) on delete cascade,
 buyer_id uuid references auth.users(id) on delete set null,
 price integer not null check(price between 10 and 10000000),
 fee integer,
 status text not null default 'active' check(status in ('active','sold','cancelled')),
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 constraint market_fee_check check(fee is null or fee>=0)
);
create unique index if not exists cardex_market_one_active_serial on public.cardex_market_listings(serial_id) where status='active';
create index if not exists cardex_market_active_date on public.cardex_market_listings(created_at desc) where status='active';
create index if not exists cardex_market_seller on public.cardex_market_listings(seller_id,created_at desc);
alter table public.cardex_market_listings enable row level security;
revoke all on public.cardex_market_listings from public,anon,authenticated;
create or replace function public.cardex_market_list(p_limit integer default 60)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb)
 from (select l.id,l.serial_id,l.seller_id,coalesce(p.display_name,'Collector') seller_name,l.price,l.created_at,c.car_id,c.finish,c.model_serial
 from public.cardex_market_listings l join public.global_card_serials c on c.id=l.serial_id
 left join public.profiles p on p.id=l.seller_id
 where l.status='active' order by l.created_at desc limit least(greatest(coalesce(p_limit,60),1),100)) t
$$;
create or replace function public.cardex_market_mine()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Sign in required'; end if;
 return jsonb_build_object(
 'inventory',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'car_id',c.car_id,'finish',c.finish,'model_serial',c.model_serial) order by c.id desc),'[]'::jsonb)
 from public.global_card_serials c where c.owner_id=u and not exists(select 1 from public.cardex_market_listings l where l.serial_id=c.id and l.status='active')),
 'listings',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'serial_id',l.serial_id,'price',l.price,'status',l.status,'car_id',c.car_id,'finish',c.finish,'model_serial',c.model_serial,'created_at',l.created_at) order by l.created_at desc),'[]'::jsonb)
 from public.cardex_market_listings l join public.global_card_serials c on c.id=l.serial_id where l.seller_id=u and l.status='active'),
 'history',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'price',l.price,'fee',l.fee,'status',l.status,'car_id',c.car_id,'finish',c.finish,'model_serial',c.model_serial,'closed_at',l.closed_at,'side',case when l.seller_id=u then 'sold' else 'bought' end) order by l.closed_at desc),'[]'::jsonb)
 from (select * from public.cardex_market_listings where (seller_id=u or buyer_id=u) and status='sold' order by closed_at desc limit 30) l join public.global_card_serials c on c.id=l.serial_id));
end $$;
create or replace function public.cardex_market_create(p_serial_id bigint,p_price integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); own uuid; n bigint;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if p_price is null or p_price<10 or p_price>10000000 then raise exception 'Price must be between 10 and 10,000,000'; end if;
 select owner_id into own from public.global_card_serials where id=p_serial_id for update;
 if own is distinct from u then raise exception 'Card not owned by you'; end if;
 if (select count(*) from public.cardex_market_listings where seller_id=u and status='active')>=10 then raise exception 'Maximum 10 active listings'; end if;
 insert into public.cardex_market_listings(serial_id,seller_id,price) values(p_serial_id,u,p_price) returning id into n;
 return jsonb_build_object('id',n);
end $$;
create or replace function public.cardex_market_cancel(p_listing_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); l public.cardex_market_listings%rowtype;
begin
 if u is null then raise exception 'Sign in required'; end if;
 select * into l from public.cardex_market_listings where id=p_listing_id for update;
 if not found or l.seller_id<>u or l.status<>'active' then raise exception 'Listing unavailable'; end if;
 update public.cardex_market_listings set status='cancelled',closed_at=now() where id=l.id;
 return jsonb_build_object('cancelled',true);
end $$;
create or replace function public.cardex_market_buy(p_listing_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); l public.cardex_market_listings%rowtype; own uuid; bal integer; cut integer;
begin
 if u is null then raise exception 'Sign in required'; end if;
 select * into l from public.cardex_market_listings where id=p_listing_id for update;
 if not found or l.status<>'active' then raise exception 'Listing no longer available'; end if;
 if l.seller_id=u then raise exception 'Cannot buy your own listing'; end if;
 -- Serial ownership is locked after the listing lock, preventing concurrent transfer.
 select owner_id into own from public.global_card_serials where id=l.serial_id for update;
 if own is distinct from l.seller_id then raise exception 'Seller no longer owns card'; end if;
 select credits into bal from public.player_wallets where user_id=u for update;
 if bal is null or bal<l.price then raise exception 'Not enough coins'; end if;
 perform 1 from public.player_wallets where user_id=l.seller_id for update;
 cut=(l.price*5+99)/100;
 update public.player_wallets set credits=credits-l.price where user_id=u;
 update public.player_wallets set credits=credits+l.price-cut where user_id=l.seller_id;
 update public.global_card_serials set owner_id=u where id=l.serial_id;
 update public.cardex_market_listings set status='sold',buyer_id=u,fee=cut,closed_at=now() where id=l.id;
 return jsonb_build_object('purchased',true,'serial_id',l.serial_id,'paid',l.price,'fee',cut);
end $$;
revoke all on function public.cardex_market_list(integer),public.cardex_market_mine(),public.cardex_market_create(bigint,integer),public.cardex_market_cancel(bigint),public.cardex_market_buy(bigint) from public,anon;
grant execute on function public.cardex_market_list(integer),public.cardex_market_mine(),public.cardex_market_create(bigint,integer),public.cardex_market_cancel(bigint),public.cardex_market_buy(bigint) to authenticated;