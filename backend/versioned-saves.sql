-- Versioned preferences saves: prevent simultaneous devices from silently overwriting each other.
alter table public.player_saves add column if not exists revision bigint not null default 0;
create or replace function public.cardex_save_preferences(p_state jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); next_revision bigint;
begin
 if uid is null then raise exception 'Sign in required';end if;
 if jsonb_typeof(p_state) is distinct from 'object' then raise exception 'Invalid save object';end if;
 if pg_catalog.octet_length(p_state::text)>65536 then raise exception 'Preferences save too large';end if;
 update public.player_saves set state=p_state,revision=revision+1,updated_at=now()
 where user_id=uid and revision=p_expected_revision
 returning revision into next_revision;
 if not found then raise exception 'SAVE_CONFLICT: another device updated this account. Reload to review the latest save.';end if;
 return jsonb_build_object('revision',next_revision);
end;$$;
revoke all on function public.cardex_save_preferences(jsonb,bigint) from public,anon;
grant execute on function public.cardex_save_preferences(jsonb,bigint) to authenticated;
-- No direct UPDATEs: all preference changes must compare revision atomically.
drop policy if exists "Own save editable" on public.player_saves;
