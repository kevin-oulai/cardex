-- CARDEX Showdown rules v2. Apply after model-serials-showdown-rewards.sql.
-- Mirror matches forbidden. 100% requires >=8% average performance advantage
-- across capped stat ratios AND strict wins on at least two of three metrics.
-- Scores from earlier rules remain recorded; reset ONLY today's standings to
-- avoid mixing incompatible scores. Preserve rewards already granted.
create or replace function public.cardex_submit_showdown(p_serial_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'UTC')::date;
  boss public.vehicle_catalog%rowtype; challenger public.vehicle_catalog%rowtype;
  result public.showdown_results%rowtype; score integer;
  power_ratio numeric; speed_ratio numeric; weight_ratio numeric; average_ratio numeric;
  better_count integer;
  i integer; prize jsonb; awarded_credits integer:=0; awarded_tickets integer:=0;
  new_claims integer[]:='{}'; wallet public.player_wallets%rowtype;
begin
 if uid is null then raise exception 'Sign in required';end if;
 perform public.cardex_publish_boss();
 select c.* into boss from public.daily_bosses b
 join public.vehicle_catalog c on c.id=b.car_id where b.challenge_date=d;
 if not found then raise exception 'No daily boss available';end if;
 select c.* into challenger from public.global_card_serials s
 join public.vehicle_catalog c on c.id=s.car_id
 where s.id=p_serial_id and s.owner_id=uid;
 if not found then raise exception 'This card is not in your online collection';end if;
 if challenger.id=boss.id then raise exception 'Mirror matches are forbidden: choose a different car model';end if;
 power_ratio:=least(1.5,challenger.hp::numeric/greatest(1,boss.hp));
 speed_ratio:=least(1.5,challenger.speed::numeric/greatest(1,boss.speed));
 weight_ratio:=least(1.5,boss.weight::numeric/greatest(1,challenger.weight));
 average_ratio:=(power_ratio+speed_ratio+weight_ratio)/3;
 better_count:=(case when challenger.hp>boss.hp then 1 else 0 end)
  +(case when challenger.speed>boss.speed then 1 else 0 end)
  +(case when challenger.weight<boss.weight then 1 else 0 end);
 score:=least(case when better_count>=2 then 100 else 99 end,
   greatest(0,round(100*average_ratio/1.08)::integer));

 -- Serialize all submissions for this user and UTC day to avoid double rewards.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(uid::text||':'||d::text,0));
 insert into public.showdown_results(challenge_date,user_id,best_score,car_serial_id,first_cleared_at)
 values(d,uid,score,p_serial_id,case when score=100 then now() else null end)
 on conflict(challenge_date,user_id) do update
 set best_score=greatest(public.showdown_results.best_score,excluded.best_score),
 car_serial_id=case when excluded.best_score>public.showdown_results.best_score
   then excluded.car_serial_id else public.showdown_results.car_serial_id end,
 updated_at=case when excluded.best_score>public.showdown_results.best_score
   then now() else public.showdown_results.updated_at end,
 first_cleared_at=coalesce(public.showdown_results.first_cleared_at,excluded.first_cleared_at)
 returning * into result;
 perform public.cardex_wallet_refill(uid);
 for i in 0..4 loop
   prize:=public.cardex_showdown_reward(i);
   if result.best_score >= (prize->>'at')::integer then
     insert into public.showdown_reward_claims(challenge_date,user_id,milestone_index)
     values(d,uid,i) on conflict do nothing;
     if found then
       new_claims:=array_append(new_claims,i);
       awarded_credits:=awarded_credits+(prize->>'credits')::integer;
       awarded_tickets:=awarded_tickets+(prize->>'tickets')::integer;
     end if;
   end if;
 end loop;
 update public.player_wallets set credits=credits+awarded_credits,
   tickets=least(100,tickets+awarded_tickets)
 where user_id=uid returning * into wallet;
 return jsonb_build_object('score',score,'best',result.best_score,
   'first_cleared_at',result.first_cleared_at,'challenge_date',d,
   'claimed',(select coalesce(jsonb_agg(milestone_index order by milestone_index),'[]'::jsonb)
     from public.showdown_reward_claims where challenge_date=d and user_id=uid),
   'new_claims',to_jsonb(new_claims),'awarded_credits',awarded_credits,
   'awarded_tickets',awarded_tickets,'wallet',to_jsonb(wallet));
end;$$;
revoke all on function public.cardex_submit_showdown(bigint) from public,anon;
grant execute on function public.cardex_submit_showdown(bigint) to authenticated;


