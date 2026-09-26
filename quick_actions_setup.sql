-- INFRONS Quick Actions
-- Run this migration in the Supabase SQL editor.

alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists structured_payload jsonb not null default '{}'::jsonb;
alter table public.messages add column if not exists action_status text;
alter table public.messages add column if not exists action_cleared_at timestamptz;

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in ('text', 'document_request', 'profile_update', 'general_query'));

alter table public.messages drop constraint if exists messages_action_status_check;
alter table public.messages add constraint messages_action_status_check
  check (action_status is null or action_status in ('pending', 'cleared', 'approved', 'rejected'));

create index if not exists messages_quick_actions_idx
  on public.messages (client_id, message_type, action_status, created_at desc);

create or replace function public.submit_portal_action(
  p_token text,
  p_action_type text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_message_id uuid;
  v_content text;
begin
  select * into v_client from public.clients where portal_token = p_token limit 1;
  if v_client.id is null then raise exception 'Invalid portal link'; end if;
  if p_action_type not in ('document_request', 'profile_update', 'general_query') then
    raise exception 'Unsupported quick action';
  end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'Invalid quick action data'; end if;

  if p_action_type = 'document_request' then
    if nullif(trim(p_payload->>'document'), '') is null then raise exception 'Document name is required'; end if;
    v_content := format('Document request: %s%s', trim(p_payload->>'document'),
      case when nullif(trim(p_payload->>'due_date'), '') is not null
        then format(' (due by %s)', p_payload->>'due_date') else '' end);
  elsif p_action_type = 'profile_update' then
    if coalesce(nullif(trim(p_payload->>'name'), ''), nullif(trim(p_payload->>'phone'), ''),
      nullif(trim(p_payload->>'email'), ''), nullif(trim(p_payload->>'company'), '')) is null then
      raise exception 'At least one profile field is required';
    end if;
    v_content := 'Profile update requested';
  else
    if nullif(trim(p_payload->>'text'), '') is null then raise exception 'Query text is required'; end if;
    v_content := 'Query: ' || trim(p_payload->>'text');
  end if;

  insert into public.messages (client_id, sender, content, is_read, message_type, structured_payload, action_status)
  values (v_client.id, 'client', v_content, false, p_action_type, p_payload, 'pending')
  returning id into v_message_id;
  return v_message_id;
end;
$$;

create or replace function public.get_pending_portal_actions()
returns table (
  id uuid, client_id uuid, client_name text, message_type text,
  structured_payload jsonb, created_at timestamptz, action_status text
)
language sql
security definer
set search_path = public
as $$
  select m.id, m.client_id, c.name, m.message_type, m.structured_payload, m.created_at, m.action_status
  from public.messages m
  join public.clients c on c.id = m.client_id
  join public.users u on u.practice_id = c.practice_id
  where u.id = auth.uid()
    and (u.role = 'principal' or c.assigned_to = auth.uid())
    and m.sender = 'client'
    and m.message_type in ('document_request', 'profile_update', 'general_query')
    and m.action_status = 'pending'
  order by m.created_at desc
  limit 50;
$$;

create or replace function public.clear_viewed_portal_actions(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.clients c join public.users u on u.practice_id = c.practice_id
    where c.id = p_client_id and u.id = auth.uid()
      and (u.role = 'principal' or c.assigned_to = auth.uid())
  ) then raise exception 'Not allowed'; end if;
  update public.messages
  set action_status = 'cleared', action_cleared_at = now()
  where client_id = p_client_id and sender = 'client'
    and message_type in ('document_request', 'general_query') and action_status = 'pending';
end;
$$;

create or replace function public.resolve_profile_update(p_message_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.messages%rowtype;
  v_client public.clients%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  select m.* into v_message from public.messages m where m.id = p_message_id and m.message_type = 'profile_update';
  if v_message.id is null then raise exception 'Profile request not found'; end if;
  select c.* into v_client from public.clients c join public.users u on u.practice_id = c.practice_id
    where c.id = v_message.client_id and u.id = auth.uid()
      and (u.role = 'principal' or c.assigned_to = auth.uid());
  if v_client.id is null then raise exception 'Not allowed'; end if;

  if p_decision = 'approved' then
    update public.clients set
      name = coalesce(nullif(trim(v_message.structured_payload->>'name'), ''), name),
      phone = case when v_message.structured_payload ? 'phone' then nullif(trim(v_message.structured_payload->>'phone'), '') else phone end,
      email = case when v_message.structured_payload ? 'email' then nullif(trim(v_message.structured_payload->>'email'), '') else email end,
      company = case when v_message.structured_payload ? 'company' then nullif(trim(v_message.structured_payload->>'company'), '') else company end
    where id = v_client.id;
  end if;
  update public.messages set action_status = p_decision, action_cleared_at = now() where id = v_message.id;
end;
$$;

revoke all on function public.submit_portal_action(text, text, jsonb) from public;
grant execute on function public.submit_portal_action(text, text, jsonb) to anon, authenticated;
revoke all on function public.get_pending_portal_actions() from public;
grant execute on function public.get_pending_portal_actions() to authenticated;
revoke all on function public.clear_viewed_portal_actions(uuid) from public;
grant execute on function public.clear_viewed_portal_actions(uuid) to authenticated;
revoke all on function public.resolve_profile_update(uuid, text) from public;
grant execute on function public.resolve_profile_update(uuid, text) to authenticated;
