-- Preserve referential integrity when a user deletes their CARDEX account.
-- Verified results must be removed before cascading deletion of their issued cards.
create or replace function public.cardex_before_auth_user_delete()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.showdown_results where user_id=old.id;
  return old;
end;$$;
revoke all on function public.cardex_before_auth_user_delete() from public,anon,authenticated;
drop trigger if exists cardex_cleanup_before_user_delete on auth.users;
create trigger cardex_cleanup_before_user_delete before delete on auth.users
for each row execute function public.cardex_before_auth_user_delete();
