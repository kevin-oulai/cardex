-- Remove unnecessary public invocation of the Auth user-created profile trigger.
-- Trigger execution by auth.users continues to work.
revoke all on function public.create_cardex_profile() from public,anon,authenticated;
