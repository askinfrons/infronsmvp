-- Practice table RLS policies for INFRONS.
-- Run this in the Supabase SQL editor if the Practice settings page reports
-- "new row violates row-level security policy for table \"practices\"".

alter table public.practices enable row level security;

drop policy if exists "Principals can insert own practice" on public.practices;
create policy "Principals can insert own practice"
on public.practices
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Practice members can read practice" on public.practices;
create policy "Practice members can read practice"
on public.practices
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.practice_id = practices.id
  )
);

drop policy if exists "Principals can update own practice" on public.practices;
create policy "Principals can update own practice"
on public.practices
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
