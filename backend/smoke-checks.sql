-- CARDEX read-only production smoke checks.
-- Run in Supabase SQL Editor after every migration. All queries must return zero.
select 'public_tables_without_rls' as check_name,count(*)::bigint as failures
from pg_tables where schemaname='public' and not rowsecurity
union all
select 'missing_model_serials',count(*) from public.global_card_serials where model_serial is null
union all
select 'duplicate_model_serials',count(*) from (
  select car_id,model_serial from public.global_card_serials
  group by car_id,model_serial having count(*)>1
) t
union all
select 'anonymous_cardex_rpc_permissions',count(*) from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'cardex_%'
and has_function_privilege('anon',p.oid,'EXECUTE')
union all
select 'direct_save_update_policies',count(*) from pg_policies
where schemaname='public' and tablename='player_saves' and cmd='UPDATE'
union all
select 'missing_core_rpcs',count(*) from (values
 ('cardex_get_wallet()'),('cardex_open_pack(integer)'),('cardex_submit_showdown(bigint)'),
 ('cardex_get_showdown_status()'),('cardex_daily_leaderboard(date)'),
 ('cardex_public_collector(uuid)'),('cardex_buy_ticket()'),
 ('cardex_recycle_duplicates(integer,text)'),('cardex_claim_achievement(integer)'),
 ('cardex_get_achievement_claims()'),('cardex_save_preferences(jsonb,bigint)'),
 ('cardex_set_collection_visibility(boolean)')
) f(signature) where to_regprocedure('public.'||f.signature) is null;
