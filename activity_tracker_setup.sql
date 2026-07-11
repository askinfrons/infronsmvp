-- INFRONS Client Activity Tracker
-- Run this once in the Supabase SQL editor before using the activity UI.

alter table public.clients
  add column if not exists portal_last_opened timestamptz,
  add column if not exists last_activity_at timestamptz;

alter table public.messages
  add column if not exists delivered_at timestamptz default now(),
  add column if not exists seen_at timestamptz,
  add column if not exists file_downloaded_at timestamptz;

create table if not exists public.client_activity (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_activity_client_created_idx
  on public.client_activity (client_id, created_at desc);

create index if not exists client_activity_practice_created_idx
  on public.client_activity (practice_id, created_at desc);

alter table public.client_activity enable row level security;

drop policy if exists "Practice members can read client activity" on public.client_activity;
create policy "Practice members can read client activity"
on public.client_activity
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.practice_id = client_activity.practice_id
  )
);

drop policy if exists "Practice members can add client activity" on public.client_activity;
create policy "Practice members can add client activity"
on public.client_activity
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.practice_id = client_activity.practice_id
  )
);

create or replace function public.log_message_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_practice_id uuid;
  v_description text;
begin
  select c.practice_id into v_practice_id
  from public.clients c
  where c.id = new.client_id;

  if v_practice_id is null then
    return new;
  end if;

  new.delivered_at = coalesce(new.delivered_at, now());

  update public.clients
  set last_activity_at = now()
  where id = new.client_id;

  v_description = case
    when new.sender = 'client' then 'Client sent a message'
    else 'Practice sent a message'
  end;

  insert into public.client_activity (client_id, practice_id, type, description, metadata)
  values (
    new.client_id,
    v_practice_id,
    'message_sent',
    v_description,
    jsonb_build_object('message_id', new.id, 'sender', new.sender)
  );

  return new;
end;
$$;

drop trigger if exists set_message_activity on public.messages;
create trigger set_message_activity
before insert on public.messages
for each row execute function public.log_message_activity();

create or replace function public.record_portal_open(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_practice_id uuid;
begin
  select c.id, c.practice_id
    into v_client_id, v_practice_id
  from public.clients c
  where c.portal_token = p_token;

  if v_client_id is null then
    return;
  end if;

  update public.clients
  set portal_last_opened = now(),
      last_activity_at = now()
  where id = v_client_id;

  insert into public.client_activity (client_id, practice_id, type, description)
  values (v_client_id, v_practice_id, 'portal_opened', 'Client opened the portal');
end;
$$;

create or replace function public.mark_client_messages_seen(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_practice_id uuid;
  v_seen_count integer;
begin
  select c.practice_id into v_practice_id
  from public.clients c
  where c.id = p_client_id;

  if v_practice_id is null then
    return;
  end if;

  update public.messages
  set is_read = true,
      seen_at = coalesce(seen_at, now())
  where client_id = p_client_id
    and sender = 'ca'
    and seen_at is null;

  get diagnostics v_seen_count = row_count;

  update public.clients
  set last_activity_at = now()
  where id = p_client_id;

  if v_seen_count > 0 then
    insert into public.client_activity (client_id, practice_id, type, description, metadata)
    values (
      p_client_id,
      v_practice_id,
      'messages_seen',
      'Client saw practice messages',
      jsonb_build_object('count', v_seen_count)
    );
  end if;
end;
$$;

create or replace function public.record_file_download(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_practice_id uuid;
  v_file_name text;
begin
  select m.client_id, c.practice_id, m.file_name
    into v_client_id, v_practice_id, v_file_name
  from public.messages m
  join public.clients c on c.id = m.client_id
  where m.id = p_message_id
    and m.file_url is not null;

  if v_client_id is null then
    return;
  end if;

  update public.messages
  set file_downloaded_at = now()
  where id = p_message_id;

  update public.clients
  set last_activity_at = now()
  where id = v_client_id;

  insert into public.client_activity (client_id, practice_id, type, description, metadata)
  values (
    v_client_id,
    v_practice_id,
    'file_downloaded',
    'File downloaded',
    jsonb_build_object('message_id', p_message_id, 'file_name', v_file_name)
  );
end;
$$;

grant execute on function public.record_portal_open(text) to anon, authenticated;
grant execute on function public.mark_client_messages_seen(uuid) to anon, authenticated;
grant execute on function public.record_file_download(uuid) to anon, authenticated;
