-- INFRONS client verification.
-- Run this migration in Supabase before enabling Require Verification.

alter table public.clients add column if not exists verification_required boolean not null default false;
alter table public.clients add column if not exists verification_status text not null default 'unverified';
alter table public.clients add column if not exists otp_verified_at timestamptz;
alter table public.clients add column if not exists verification_override_at timestamptz;
alter table public.clients add column if not exists verification_rejection_reason text;

alter table public.clients drop constraint if exists clients_verification_status_check;
alter table public.clients add constraint clients_verification_status_check
  check (verification_status in ('unverified', 'otp_verified', 'fully_verified', 'rejected'));

create table if not exists public.client_verification_otps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  channel text not null check (channel in ('email', 'phone')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists client_verification_otps_client_created_idx
  on public.client_verification_otps (client_id, created_at desc);

create table if not exists public.client_verification_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  file_size bigint not null default 0,
  file_type text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists client_verification_documents_review_idx
  on public.client_verification_documents (practice_id, status, created_at desc);

do $$
begin
  alter publication supabase_realtime add table public.client_verification_documents;
exception
  when duplicate_object then null;
end;
$$;

insert into storage.buckets (id, name, public)
values ('client-verification-documents', 'client-verification-documents', false)
on conflict (id) do nothing;

alter table public.client_verification_otps enable row level security;
alter table public.client_verification_documents enable row level security;
grant select, update on public.client_verification_documents to authenticated;

create or replace function public.can_access_verification_client(p_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    join public.users u on u.practice_id = c.practice_id
    where c.id = p_client_id and u.id = auth.uid()
      and (u.role = 'principal' or c.assigned_to = auth.uid())
  );
$$;

grant execute on function public.can_access_verification_client(uuid) to authenticated;

drop policy if exists "Practice members can view verification documents" on public.client_verification_documents;
create policy "Practice members can view verification documents"
on public.client_verification_documents for select to authenticated
using (public.can_access_verification_client(client_id));

drop policy if exists "Practice members can review verification documents" on public.client_verification_documents;
create policy "Practice members can review verification documents"
on public.client_verification_documents for update to authenticated
using (public.can_access_verification_client(client_id))
with check (public.can_access_verification_client(client_id));

drop policy if exists "Practice members can read verification files" on storage.objects;
create policy "Practice members can read verification files"
on storage.objects for select to authenticated
using (
  bucket_id = 'client-verification-documents'
  and public.can_access_verification_client((storage.foldername(name))[1]::uuid)
);

create or replace function public.get_portal_verification_state(p_token text)
returns table (
  client_id uuid, client_name text, verification_required boolean,
  verification_status text, otp_verified_at timestamptz,
  email text, phone text, rejection_reason text
)
language sql
security definer
set search_path = public
as $$
  select id, name, verification_required, verification_status, otp_verified_at,
    email, phone, verification_rejection_reason
  from public.clients where portal_token = p_token limit 1;
$$;

grant execute on function public.get_portal_verification_state(text) to anon, authenticated;

create or replace function public.set_verification_review(
  p_document_id uuid, p_status text, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.client_verification_documents%rowtype;
begin
  if p_status not in ('approved', 'rejected') then raise exception 'Invalid review status'; end if;
  select d.* into v_document from public.client_verification_documents d where d.id = p_document_id;
  if v_document.id is null or not public.can_access_verification_client(v_document.client_id) then
    raise exception 'Not allowed';
  end if;
  update public.client_verification_documents
  set status = p_status, rejection_reason = case when p_status = 'rejected' then nullif(trim(p_reason), '') else null end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_document_id;
  if p_status = 'approved' then
    update public.clients set verification_status = case when otp_verified_at is not null then 'fully_verified' else verification_status end,
      verification_rejection_reason = null where id = v_document.client_id;
  else
    update public.clients set verification_status = 'rejected', verification_rejection_reason = nullif(trim(p_reason), '')
      where id = v_document.client_id;
  end if;
end;
$$;

create or replace function public.set_client_verification_override(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_verification_client(p_client_id) then raise exception 'Not allowed'; end if;
  update public.clients set verification_status = 'fully_verified', verification_override_at = now(),
    verification_rejection_reason = null where id = p_client_id;
end;
$$;

grant execute on function public.set_verification_review(uuid, text, text) to authenticated;
grant execute on function public.set_client_verification_override(uuid) to authenticated;
revoke all on function public.get_portal_verification_state(text) from public;
grant execute on function public.get_portal_verification_state(text) to anon, authenticated;
