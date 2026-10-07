-- Keep client activity focused on client activity, not CA outbound messages.
-- Run this after activity_tracker_setup.sql.

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
  select c.practice_id into v_practice_id from public.clients c where c.id = new.client_id;
  if v_practice_id is null then return new; end if;

  new.delivered_at = coalesce(new.delivered_at, now());

  if new.sender = 'client' then
    update public.clients set last_activity_at = now() where id = new.client_id;
    v_description = 'Client sent a message';
    insert into public.client_activity (client_id, practice_id, type, description, metadata)
    values (new.client_id, v_practice_id, 'message_sent', v_description,
      jsonb_build_object('message_id', new.id, 'sender', new.sender));
  end if;

  return new;
end;
$$;

drop trigger if exists set_message_activity on public.messages;
create trigger set_message_activity
before insert on public.messages
for each row execute function public.log_message_activity();

update public.clients c
set last_activity_at = case
  when c.portal_last_opened is null then (
    select max(m.created_at) from public.messages m
    where m.client_id = c.id and m.sender = 'client'
  )
  when (
    select max(m.created_at) from public.messages m
    where m.client_id = c.id and m.sender = 'client'
  ) is null then c.portal_last_opened
  else greatest(
    c.portal_last_opened,
    (select max(m.created_at) from public.messages m
     where m.client_id = c.id and m.sender = 'client')
  )
end;
