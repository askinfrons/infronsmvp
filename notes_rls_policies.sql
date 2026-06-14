-- Notes table RLS policies for INFRONS.
-- Fixes: "new row violates row-level security policy for table \"notes\""
-- Run this in the Supabase SQL editor.

alter table public.notes enable row level security;

-- Practice members can view notes for clients in their practice
-- (staff only for clients assigned to them)
drop policy if exists "Practice members can view notes" on public.notes;
create policy "Practice members can view notes"
on public.notes
for select
to authenticated
using (
  exists (
    select 1
    from public.clients c
    join public.users u on u.practice_id = c.practice_id
    where c.id = notes.client_id
      and u.id = auth.uid()
      and (u.role = 'principal' or c.assigned_to = auth.uid())
  )
);

-- Practice members can insert notes, only as themselves
drop policy if exists "Practice members can insert notes" on public.notes;
create policy "Practice members can insert notes"
on public.notes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.clients c
    join public.users u on u.practice_id = c.practice_id
    where c.id = notes.client_id
      and u.id = auth.uid()
      and (u.role = 'principal' or c.assigned_to = auth.uid())
  )
);

-- Only the note author can edit their own note
drop policy if exists "Note authors can update own notes" on public.notes;
create policy "Note authors can update own notes"
on public.notes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Only the note author can delete their own note
drop policy if exists "Note authors can delete own notes" on public.notes;
create policy "Note authors can delete own notes"
on public.notes
for delete
to authenticated
using (user_id = auth.uid());
