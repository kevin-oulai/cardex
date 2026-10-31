-- The catalog expanded from IDs 0-95 to IDs 0-191.
-- Both card issuance and daily boss selection must accept the same range.
begin;
alter table public.global_card_serials drop constraint global_card_serials_car_id_check;
alter table public.global_card_serials add constraint global_card_serials_car_id_check check (car_id between 0 and 191);
alter table public.daily_bosses drop constraint daily_bosses_car_id_check;
alter table public.daily_bosses add constraint daily_bosses_car_id_check check (car_id between 0 and 191);
commit;
