-- CARDEX content expansion compatibility audit, 2026-10-31.
-- Achievements 0..9, car IDs 0..191; existing Showdown reward indices 0..4 remain unchanged.
begin;
alter table public.achievement_claims drop constraint achievement_claims_achievement_id_check;
alter table public.achievement_claims add constraint achievement_claims_achievement_id_check check (achievement_id between 0 and 9);
commit;

-- Select daily bosses from the current catalog rather than a hardcoded 96 IDs.
-- Existing published daily bosses are preserved by ON CONFLICT DO NOTHING.
create or replace function public.cardex_publish_boss()
returns jsonb language plpgsql security definer set search_path='' as $$
declare d date:=(now() at time zone 'UTC')::date; chosen integer; catalog_count integer;
begin
 select count(*)::integer into catalog_count from public.vehicle_catalog;
 if catalog_count=0 then raise exception 'Vehicle catalog is empty';end if;
 select id into chosen from public.vehicle_catalog order by id
 offset (((((d-date '1970-01-01')::bigint*17+7)%catalog_count)+catalog_count)%catalog_count)
 limit 1;
 insert into public.daily_bosses(challenge_date,car_id)
 values(d,chosen) on conflict(challenge_date) do nothing;
 return (select to_jsonb(b) from public.daily_bosses b where challenge_date=d);
end;$$;
