-- Migration: Fix split practice data for user 4258fd03-683c-4b46-bd01-1e332866a555 (anshul@gmail.com)
--
-- Problem:
--   users.id        = 4258fd03-683c-4b46-bd01-1e332866a555
--   users.practice_id = 9b42e17d-3cb6-4270-9620-161c6dbbeb30  (mismatch — not his own id)
--
--   Clients are split across two practice_id values:
--     4258fd03-683c-4b46-bd01-1e332866a555  -> 2 clients (orphaned, no matching practices row)
--     9b42e17d-3cb6-4270-9620-161c6dbbeb30  -> 2 clients (currently "active" practice per users.practice_id)
--
--   RLS update policy on practices requires id = auth.uid(), which is 4258fd03-...
--   Since users.practice_id points elsewhere, the dashboard reads/writes the wrong
--   practice row and Settings saves silently fail.
--
-- Fix: consolidate everything under practices.id = users.id = 4258fd03-...
-- This is additive/repointing only. No rows are deleted.

begin;

-- 1. Ensure a practices row exists with id = the user's own auth id.
--    Use the user's real email directly (do not carry over the old
--    placeholder row's email — it collides with the unique constraint
--    on practices.email since 9b42e17d-... still holds 'youremail@gmail.com').
insert into public.practices (id, name, email)
values (
  '4258fd03-683c-4b46-bd01-1e332866a555'::uuid,
  'Practice',
  'anshul@gmail.com'
)
on conflict (id) do update
set
  name = excluded.name,
  email = excluded.email;

-- 2. Move the 2 clients currently under the mismatched practice_id (9b42e17d-...)
--    so they belong to the user's own practice_id (4258fd03-...).
update public.clients
set practice_id = '4258fd03-683c-4b46-bd01-1e332866a555'::uuid
where practice_id = '9b42e17d-3cb6-4270-9620-161c6dbbeb30'::uuid;

-- 3. Repoint the user's practice_id to match their own id.
update public.users
set practice_id = '4258fd03-683c-4b46-bd01-1e332866a555'::uuid
where id = '4258fd03-683c-4b46-bd01-1e332866a555'::uuid;

-- 4. (Optional cleanup, left commented out on purpose — review before running)
-- The old practice row (9b42e17d-...) and its "Your CA Practice Name" / "youremail@gmail.com"
-- placeholder data is now unreferenced by any user or client. Not deleted automatically
-- to avoid destructive action without explicit confirmation. To remove it later:
-- delete from public.practices where id = '9b42e17d-3cb6-4270-9620-161c6dbbeb30'::uuid;

commit;

-- Verification queries (run after the above):
-- select id, practice_id, role, full_name from public.users where id = '4258fd03-683c-4b46-bd01-1e332866a555'::uuid;
-- select id, practice_id, name, company from public.clients where practice_id = '4258fd03-683c-4b46-bd01-1e332866a555'::uuid;
-- Expect: users.practice_id = users.id, and 4 clients now under practice_id = 4258fd03-...
