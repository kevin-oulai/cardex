-- Apply after authoritative-game.sql and leaderboard-migration.sql.
-- Authenticated, server-validated daily Showdown submissions.
-- All scores computed from server catalog and server-issued card ownership.
create or replace function public.cardex_submit_showdown(p_serial_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'UTC')::date;
  boss public.vehicle_catalog%rowtype; challenger public.vehicle_catalog%rowtype;
  result public.showdown_results%rowtype; score integer; prior integer;
  power_score integer; speed_score integer; weight_score integer;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 -- This also ensures a boss exists for today's UTC date.
 perform public.cardex_publish_boss();
 select c.* into boss from public.daily_bosses b
 join public.vehicle_catalog c on c.id=b.car_id where b.challenge_date=d;
 if not found then raise exception 'No daily boss available';end if;
 select c.* into challenger from public.global_card_serials s
 join public.vehicle_catalog c on c.id=s.car_id
 where s.id=p_serial_id and s.owner_id=uid;
 if not found then raise exception 'This card is not in your online collection';end if;
 power_score:=least(100,greatest(0,round(100.0*challenger.hp/greatest(1,boss.hp))::integer));
 speed_score:=least(100,greatest(0,round(100.0*challenger.speed/greatest(1,boss.speed))::integer));
 weight_score:=least(100,greatest(0,round(100.0*boss.weight/greatest(1,challenger.weight))::integer));
 score:=round((power_score+speed_score+weight_score)/3.0)::integer;
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
 return jsonb_build_object('score',score,'best',result.best_score,
   'first_cleared_at',result.first_cleared_at,'challenge_date',d);
end;$$;
revoke all on function public.cardex_submit_showdown(bigint) from public,anon;
grant execute on function public.cardex_submit_showdown(bigint) to authenticated;
