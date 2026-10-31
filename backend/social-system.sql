create table if not exists public.cardex_friend_requests(
 id bigint generated always as identity primary key,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint cardex_friend_requests_distinct check(sender_id<>recipient_id)
);
create unique index if not exists cardex_friend_requests_pair_unique on public.cardex_friend_requests(least(sender_id,recipient_id),greatest(sender_id,recipient_id));
create index if not exists cardex_friend_requests_recipient_idx on public.cardex_friend_requests(recipient_id,status);
alter table public.cardex_friend_requests enable row level security;
revoke all on public.cardex_friend_requests from anon,authenticated;
create table if not exists public.cardex_notifications(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('friend_request','friend_accepted','system')),
 message text not null check(char_length(message)<=220),
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists cardex_notifications_user_idx on public.cardex_notifications(user_id,created_at desc);
alter table public.cardex_notifications enable row level security;
revoke all on public.cardex_notifications from anon,authenticated;

create or replace function public.cardex_social_list()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null then raise exception 'Sign in required';end if;
 return jsonb_build_object(
 'friends',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'public',p.public_collection))
 from public.cardex_friend_requests r join public.profiles p on p.id=case when r.sender_id=u then r.recipient_id else r.sender_id end
 where (r.sender_id=u or r.recipient_id=u) and r.status='accepted'),'[]'::jsonb),
 'incoming',coalesce((select jsonb_agg(jsonb_build_object('request_id',r.id,'id',p.id,'name',p.display_name,'created_at',r.created_at))
 from public.cardex_friend_requests r join public.profiles p on p.id=r.sender_id
 where r.recipient_id=u and r.status='pending'),'[]'::jsonb),
 'outgoing',coalesce((select jsonb_agg(jsonb_build_object('request_id',r.id,'id',p.id,'name',p.display_name))
 from public.cardex_friend_requests r join public.profiles p on p.id=r.recipient_id
 where r.sender_id=u and r.status='pending'),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'actor_id',n.actor_id,'kind',n.kind,'message',n.message,'read',n.read_at is not null,'created_at',n.created_at) order by n.created_at desc)
 from (select * from public.cardex_notifications where user_id=u order by created_at desc limit 60) n),'[]'::jsonb)
 );
end;$$;
create or replace function public.cardex_social_search(p_query text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null then raise exception 'Sign in required';end if;
 if length(trim(coalesce(p_query,'')))<2 then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'public',p.public_collection))
 from (select id,display_name,public_collection from public.profiles
 where id<>u and display_name ilike '%'||replace(replace(replace(left(trim(p_query),50),'\\','\\\\'),'%','\\%'),'_','\\_')||'%' escape '\'
 order by display_name limit 20) p),'[]'::jsonb);
end;$$;
create or replace function public.cardex_social_action(p_action text,p_target uuid default null,p_request bigint default null,p_notification bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.cardex_friend_requests%rowtype; nm text;begin
 if u is null then raise exception 'Sign in required';end if;
 if p_action='send' then
  if p_target is null or p_target=u then raise exception 'Invalid recipient';end if;
  select display_name into nm from public.profiles where id=p_target;
  if nm is null then raise exception 'Collector not found';end if;
  select * into r from public.cardex_friend_requests
  where (sender_id=u and recipient_id=p_target) or (sender_id=p_target and recipient_id=u) for update;
  if found then
   if r.status='accepted' then raise exception 'Already friends';end if;
   if r.status='pending' then raise exception 'Request already pending';end if;
   update public.cardex_friend_requests set sender_id=u,recipient_id=p_target,status='pending',updated_at=now() where id=r.id;
  else
   insert into public.cardex_friend_requests(sender_id,recipient_id) values(u,p_target);
  end if;
  insert into public.cardex_notifications(user_id,actor_id,kind,message) values(p_target,u,'friend_request','sent you a friend request');
 elsif p_action in ('accept','decline') then
  select * into r from public.cardex_friend_requests where id=p_request and recipient_id=u and status='pending' for update;
  if not found then raise exception 'Pending incoming request not found';end if;
  update public.cardex_friend_requests set status=case when p_action='accept' then 'accepted' else 'declined' end,updated_at=now() where id=r.id;
  if p_action='accept' then
   insert into public.cardex_notifications(user_id,actor_id,kind,message) values(r.sender_id,u,'friend_accepted','accepted your friend request');
  end if;
 elsif p_action='remove' then
  delete from public.cardex_friend_requests where status='accepted' and ((sender_id=u and recipient_id=p_target) or (sender_id=p_target and recipient_id=u));
  if not found then raise exception 'Friend not found';end if;
 elsif p_action='cancel' then
  delete from public.cardex_friend_requests where sender_id=u and recipient_id=p_target and status='pending';
  if not found then raise exception 'Outgoing request not found';end if;
 elsif p_action='read' then
  update public.cardex_notifications set read_at=coalesce(read_at,now()) where id=p_notification and user_id=u;
 elsif p_action='read_all' then
  update public.cardex_notifications set read_at=now() where user_id=u and read_at is null;
 else raise exception 'Unknown social action';end if;
 return public.cardex_social_list();
end;$$;
create or replace function public.cardex_social_garage(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); allowed boolean;begin
 if u is null then raise exception 'Sign in required';end if;
 select (public_collection or id=u) into allowed from public.profiles where id=p_user_id;
 if not coalesce(allowed,false) then return jsonb_build_object('private',true,'cards','[]'::jsonb);end if;
 return jsonb_build_object('private',false,'cards',coalesce((
 select jsonb_agg(to_jsonb(t) order by t.car_id,t.finish) from
 (select car_id,finish,count(*)::integer as copies,min(model_serial) as first_serial
 from public.global_card_serials where owner_id=p_user_id
 group by car_id,finish order by car_id,finish limit 500) t),'[]'::jsonb));
end;$$;
revoke all on function public.cardex_social_list(),public.cardex_social_search(text),public.cardex_social_action(text,uuid,bigint,bigint),public.cardex_social_garage(uuid) from public,anon;
grant execute on function public.cardex_social_list(),public.cardex_social_search(text),public.cardex_social_action(text,uuid,bigint,bigint),public.cardex_social_garage(uuid) to authenticated;