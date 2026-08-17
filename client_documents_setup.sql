-- INFRONS per-client document storage.
-- Run this once in the Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_path text not null unique,
  file_size bigint not null default 0,
  file_type text,
  created_at timestamptz not null default now()
);

create index if not exists client_documents_client_created_idx
  on public.client_documents (client_id, created_at desc);

create index if not exists client_documents_practice_created_idx
  on public.client_documents (practice_id, created_at desc);

alter table public.client_documents enable row level security;

grant select, insert, delete on public.client_documents to authenticated;

create or replace function public.can_access_client(p_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clients c
    join public.users u on u.practice_id = c.practice_id
    where c.id = p_client_id
      and u.id = auth.uid()
      and (u.role = 'principal' or c.assigned_to = auth.uid())
  );
$$;

create or replace function public.can_access_client_path(p_client_id_text text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.can_access_client(p_client_id_text::uuid);
exception
  when invalid_text_representation then
    return false;
end;
$$;

grant execute on function public.can_access_client(uuid) to authenticated;
grant execute on function public.can_access_client_path(text) to authenticated;

drop policy if exists "Practice members can view client documents" on public.client_documents;
create policy "Practice members can view client documents"
on public.client_documents
for select
to authenticated
using (public.can_access_client(client_documents.client_id));

drop policy if exists "Practice members can insert client documents" on public.client_documents;
create policy "Practice members can insert client documents"
on public.client_documents
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and practice_id = (
    select c.practice_id
    from public.clients c
    where c.id = client_documents.client_id
  )
  and public.can_access_client(client_documents.client_id)
);

drop policy if exists "Practice members can delete client documents" on public.client_documents;
create policy "Practice members can delete client documents"
on public.client_documents
for delete
to authenticated
using (public.can_access_client(client_documents.client_id));

drop policy if exists "Practice members can upload client document files" on storage.objects;
create policy "Practice members can upload client document files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-documents'
  and public.can_access_client_path((storage.foldername(name))[1])
);

drop policy if exists "Practice members can read client document files" on storage.objects;
create policy "Practice members can read client document files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-documents'
  and public.can_access_client_path((storage.foldername(name))[1])
);

drop policy if exists "Practice members can delete client document files" on storage.objects;
create policy "Practice members can delete client document files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-documents'
  and public.can_access_client_path((storage.foldername(name))[1])
);
