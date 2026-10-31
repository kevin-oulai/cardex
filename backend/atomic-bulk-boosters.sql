-- Atomic bulk booster opening: all packs succeed or none are issued.
create or replace function public.cardex_open_packs(p_theme integer,p_quantity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i integer; result jsonb; cards jsonb:='[]'::jsonb; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_theme is null or p_theme not between 0 and 3 then raise exception 'Invalid theme';end if;
 if p_quantity is null or p_quantity not in (1,5,10) then raise exception 'Choose 1, 5 or 10 packs';end if;
 perform public.cardex_wallet_refill(uid);
 if (select tickets from public.player_wallets where user_id=uid for update)<p_quantity then
  raise exception 'Not enough tickets';
 end if;
 for i in 1..p_quantity loop
  result:=public.cardex_open_pack(p_theme);
  cards:=cards||coalesce(result->'cards','[]'::jsonb);
 end loop;
 return jsonb_build_object('cards',cards,'quantity',p_quantity);
end;$$;
revoke all on function public.cardex_open_packs(integer,integer) from public,anon;
grant execute on function public.cardex_open_packs(integer,integer) to authenticated;