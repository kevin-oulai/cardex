-- CARDEX authoritative card issuance, wallet and daily boss.
-- Run after schema.sql, leaderboard-migration.sql, cloud-saves.sql.
-- IMPORTANT: existing local/cloud save balances and cards are unverified and NOT imported.
create table if not exists public.vehicle_catalog (
  id integer primary key, country text not null, rarity text not null,
  hp integer not null, weight integer not null, speed integer not null,
  motorsport boolean not null default false
);
insert into public.vehicle_catalog(id,country,rarity,hp,weight,speed,motorsport) values
(0,'Japan','Common',130,950,200,false),
(1,'Japan','Common',160,1080,215,false),
(2,'Germany','Common',90,1000,175,false),
(3,'USA','Common',182,1163,220,false),
(4,'France','Common',130,875,205,false),
(5,'Japan','Uncommon',116,980,195,false),
(6,'Germany','Uncommon',220,1351,246,false),
(7,'Japan','Uncommon',280,1270,240,false),
(8,'Germany','Uncommon',286,1460,250,false),
(9,'France','Uncommon',255,1400,246,false),
(10,'Japan','Rare',280,1280,250,false),
(11,'Japan','Rare',280,1360,240,false),
(12,'Germany','Rare',360,1385,250,false),
(13,'Japan','Rare',270,1370,270,false),
(14,'Germany','Rare',315,1595,262,false),
(15,'Japan','Super Rare',280,1560,250,false),
(16,'Germany','Super Rare',525,1450,296,false),
(17,'Italy','Super Rare',450,890,225,true),
(18,'Japan','Super Rare',560,1480,325,false),
(19,'Italy','Ultra Rare',478,1100,324,false),
(20,'Germany','Ultra Rare',612,1380,330,false),
(21,'France','Ultra Rare',1001,1888,407,false),
(22,'Germany','Ultra Rare',612,1440,320,true),
(23,'UK','Legendary',600,1050,330,true),
(24,'Italy','Legendary',300,880,280,true),
(25,'Germany','Legendary',600,800,360,true),
(26,'Japan','Rare',320,1560,250,false),
(27,'Japan','Uncommon',250,1240,235,false),
(28,'Japan','Uncommon',240,1250,240,false),
(29,'Japan','Common',287,1460,250,false),
(30,'Japan','Uncommon',261,1280,230,false),
(31,'Japan','Rare',255,1390,245,true),
(32,'Japan','Common',200,1253,226,false),
(33,'Japan','Rare',320,1715,250,false),
(34,'Japan','Uncommon',300,1550,250,false),
(35,'Japan','Uncommon',195,1125,233,false),
(36,'Japan','Uncommon',200,1250,240,false),
(37,'Japan','Common',231,1370,235,false),
(38,'Japan','Super Rare',485,1740,310,false),
(39,'Japan','Uncommon',320,1380,272,false),
(40,'Germany','Rare',200,1200,235,false),
(41,'Germany','Rare',400,1795,250,false),
(42,'Germany','Rare',480,1700,250,false),
(43,'Germany','Super Rare',235,1340,250,false),
(44,'Germany','Ultra Rare',730,1615,325,false),
(45,'Germany','Rare',200,1290,222,true),
(46,'Germany','Super Rare',540,1595,320,false),
(47,'Germany','Common',265,1344,250,false),
(48,'Germany','Rare',300,1300,260,false),
(49,'Germany','Legendary',887,1675,345,false),
(50,'Germany','Ultra Rare',450,1450,317,false),
(51,'Germany','Legendary',544,1150,308,true),
(52,'Italy','Super Rare',570,1380,325,false),
(53,'Italy','Legendary',660,1365,355,false),
(54,'Italy','Legendary',950,1585,350,false),
(55,'Italy','Ultra Rare',455,1490,295,false),
(56,'Italy','Ultra Rare',640,1665,340,false),
(57,'Italy','Super Rare',640,1382,325,false),
(58,'Italy','Super Rare',190,980,230,true),
(59,'Italy','Rare',510,1524,307,false),
(60,'Italy','Legendary',602,1230,345,false),
(61,'Italy','Legendary',730,1350,370,false),
(62,'UK','Ultra Rare',720,1419,341,false),
(63,'UK','Legendary',903,1490,350,false),
(64,'UK','Uncommon',118,725,202,false),
(65,'UK','Rare',218,935,238,false),
(66,'UK','Rare',510,1695,307,false),
(67,'UK','Ultra Rare',542,1470,341,false),
(68,'USA','Uncommon',460,1681,250,false),
(69,'USA','Super Rare',550,1521,330,false),
(70,'USA','Ultra Rare',647,1385,348,false),
(71,'USA','Rare',505,1420,319,false),
(72,'USA','Super Rare',670,1561,312,false),
(73,'USA','Rare',450,1530,298,false),
(74,'USA','Uncommon',707,2020,320,false),
(75,'USA','Ultra Rare',425,1068,264,false),
(76,'France','Rare',160,970,200,true),
(77,'France','Super Rare',300,1230,220,true),
(78,'France','Super Rare',300,1200,200,true),
(79,'France','Legendary',1479,1995,420,false),
(80,'Sweden','Legendary',1160,1395,447,false),
(81,'Sweden','Legendary',1280,1420,480,false),
(82,'Sweden','Uncommon',240,1460,250,false),
(83,'South Korea','Common',275,1429,250,false),
(84,'South Korea','Common',365,1810,270,false),
(85,'Croatia','Legendary',1914,2150,412,false),
(86,'Italy','Exotic',478,1100,324,false),
(87,'Germany','Exotic',469,1170,342,false),
(88,'Germany','Exotic',300,1300,270,false),
(89,'Italy','Exotic',640,1339,310,false),
(90,'Germany','Exotic',536,3850,160,false),
(91,'France','Limited',1479,1995,420,false),
(92,'Italy','Limited',740,1490,355,false),
(93,'UK','Limited',1140,1355,350,false),
(94,'UK','Limited',1035,1430,403,false),
(95,'Italy','Limited',789,1250,355,false)
on conflict (id) do update set country=excluded.country,rarity=excluded.rarity,hp=excluded.hp,weight=excluded.weight,speed=excluded.speed,motorsport=excluded.motorsport;

create table if not exists public.player_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tickets integer not null default 10 check (tickets between 0 and 100),
  last_refill timestamptz not null default now(),
  opened integer not null default 0 check (opened>=0),
  pity integer not null default 0 check (pity>=0),
  xp integer not null default 0 check (xp>=0),
  credits integer not null default 0 check (credits>=0)
);
alter table public.vehicle_catalog enable row level security;
alter table public.player_wallets enable row level security;
drop policy if exists "Catalog public" on public.vehicle_catalog;
create policy "Catalog public" on public.vehicle_catalog for select to anon,authenticated using (true);
drop policy if exists "Own wallet readable" on public.player_wallets;
create policy "Own wallet readable" on public.player_wallets for select to authenticated using (user_id=(select auth.uid()));
-- Only SECURITY DEFINER functions may change wallets or issue cards.

create or replace function public.cardex_wallet_refill(p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare w public.player_wallets%rowtype; elapsed integer;
begin
 select * into w from public.player_wallets where user_id=p_user for update;
 if not found then
   insert into public.player_wallets(user_id) values(p_user) on conflict do nothing;
   select * into w from public.player_wallets where user_id=p_user for update;
 end if;
 if w.tickets>=10 then
   update public.player_wallets set last_refill=now() where user_id=p_user;
 else
   elapsed=greatest(0,floor(extract(epoch from now()-w.last_refill)/600)::integer);
   if elapsed>0 then
     update public.player_wallets set tickets=least(10,w.tickets+elapsed),
       last_refill=case when w.tickets+elapsed>=10 then now() else w.last_refill+(elapsed*interval '10 minutes') end
     where user_id=p_user;
   end if;
 end if;
end;$$;
revoke all on function public.cardex_wallet_refill(uuid) from public,anon,authenticated;

create or replace function public.cardex_open_pack(p_theme integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); w public.player_wallets%rowtype;
  j integer; tier integer; chosen public.vehicle_catalog%rowtype;
  drawn integer[]:='{}'; cards jsonb:='[]'::jsonb; r double precision;
  finish text; serial bigint; got_high boolean:=false;
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
   insert into public.global_card_serials(car_id,finish,owner_id)
     values(chosen.id,finish,uid) returning id into serial;
   cards:=cards||jsonb_build_array(jsonb_build_object('id',chosen.id,'finish',finish,'serial',serial));
   if chosen.rarity in ('Legendary','Exotic','Limited') then got_high:=true;end if;
 end loop;
 update public.player_wallets set tickets=tickets-1,opened=opened+1,xp=xp+50,
   pity=case when got_high then 0 else pity+1 end where user_id=uid;
 return jsonb_build_object('cards',cards,'wallet',
   (select to_jsonb(x) from public.player_wallets x where x.user_id=uid));
end;$$;
revoke all on function public.cardex_open_pack(integer) from public,anon;
grant execute on function public.cardex_open_pack(integer) to authenticated;

create or replace function public.cardex_get_wallet()
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required';end if;
 perform public.cardex_wallet_refill(uid);
 return (select to_jsonb(w) from public.player_wallets w where user_id=uid);
end;$$;
revoke all on function public.cardex_get_wallet() from public,anon;
grant execute on function public.cardex_get_wallet() to authenticated;

create or replace function public.cardex_publish_boss()
returns jsonb language plpgsql security definer set search_path='' as $$
declare d date:=(now() at time zone 'UTC')::date; chosen integer;
begin
 -- deterministic daily catalog selection, same for all users.
 chosen:=(((d-date '1970-01-01')*17+7)%96+96)%96;
 insert into public.daily_bosses(challenge_date,car_id)
 values(d,chosen) on conflict(challenge_date) do nothing;
 return (select to_jsonb(b) from public.daily_bosses b where challenge_date=d);
end;$$;
revoke all on function public.cardex_publish_boss() from public,anon;
grant execute on function public.cardex_publish_boss() to authenticated;
-- Public boss rows can be read by anonymous visitors after an authenticated player publishes one.
