-- Atomic bulk ticket purchases. Existing single-ticket RPC remains supported.
create or replace function public.cardex_buy_tickets(p_quantity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); w public.player_wallets%rowtype;
begin
 if uid is null then raise exception 'Sign in required';end if;
 if p_quantity is null or p_quantity not in (1,5,10) then
   raise exception 'Choose 1, 5, or 10 tickets';
 end if;
 perform public.cardex_wallet_refill(uid);
 select * into w from public.player_wallets where user_id=uid for update;
 if not found then raise exception 'Wallet not found';end if;
 if w.tickets+p_quantity>100 then raise exception 'Ticket capacity reached (100 max)';end if;
 if w.credits<p_quantity*250 then raise exception 'Not enough credits';end if;
 update public.player_wallets
 set credits=credits-p_quantity*250,tickets=tickets+p_quantity
 where user_id=uid returning * into w;
 return jsonb_build_object('quantity',p_quantity,'cost',p_quantity*250,'wallet',to_jsonb(w));
end;$$;
revoke all on function public.cardex_buy_tickets(integer) from public,anon;
grant execute on function public.cardex_buy_tickets(integer) to authenticated;
