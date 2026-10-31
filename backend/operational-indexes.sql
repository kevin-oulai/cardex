-- Indexes for daily Showdown history and collector profile lookups.
create index if not exists cardex_showdown_user_date_idx
 on public.showdown_results(user_id,challenge_date desc);
create index if not exists cardex_showdown_card_serial_idx
 on public.showdown_results(car_serial_id) where car_serial_id is not null;
create index if not exists cardex_cards_owner_model_finish_idx
 on public.global_card_serials(owner_id,car_id,finish,id);
-- Counter table intentionally has RLS with zero client policies.
