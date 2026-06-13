# INFRONS Development Session Handoff

## Goal
Build INFRONS — a client communication web app for CA (Chartered Accountant) practices in India. This is NOT accounting software or a Tally replacement. It's a dedicated workspace where CAs manage all client conversations in one centralized place, and clients access their portal via a unique link without installing any app.

## Tech Stack
- **Frontend**: React with hooks, React Router
- **Styling**: Tailwind CSS v4 with @tailwindcss/postcss
- **Backend**: Supabase (database, auth, realtime, file storage)
- **Deployment**: Vercel
- **Project ID**: egctgqjdjhvkjnqabxtr

## Bug Fixes Applied
- **Signup.jsx**: Removed duplicate `const [focusedField, setFocusedField] = useState(null)` and fixed malformed `fields.push(` (missing opening `{` for practice name object)
- **Dashboard.jsx**: `handleAddClient` was hardcoding `practice_id: user.id` — broken for staff users whose `practice_id` differs from `user.id`. Fixed by storing resolved `practiceId` in component state during `fetchClients` and using that in the insert.
- **Resend email**: Team invite email now uses server-side `api/send-invite.js` with the official `resend` SDK. Use `RESEND_API_KEY` in `.env` and Vercel env vars; do not expose the key in frontend code.
- **Dashboard row border**: Was using `clients.length` instead of `displayedClients.length` — last row would incorrectly show/hide border when filters are active.
- **Import paths**: All files are flat at project root. App.jsx was importing from `./pages/` (nonexistent). Sidebar and supabaseClient were imported as `../X` instead of `./X`. All fixed.

## UI Polish (Login, Signup, Sidebar, Dashboard)
- **Brand palette**: Accent shifted from `#4F6EF7` → `#6366f1` / `#4f46e5` to match logo gradient
- **index.css**: Full CSS variable overhaul — new brand tokens, light sidebar vars
- **Sidebar**: Rebuilt as light white sidebar. Logo replaced with "infrons." wordmark (gradient text matching logo). NavItems use indigo active state, light hover. Sign out shows red on hover. User avatar is indigo square.
- **Login/Signup left panel**: Dark navy-to-indigo gradient (`#0f0f1a → #2d2b6b`), ambient radial glows, gradient headline highlight, feature icons with indigo-tinted backgrounds. Logo is wordmark "infrons." in white + indigo dot.
- **Login/Signup right panel**: bg `#f5f5fb`, inputs focus with indigo ring, submit button indigo with shadow
- **Dashboard topbar**: Height 56px, subtle `#f3f4f6` bottom border
- **All pages**: Accent color globally replaced across Dashboard, Messages, Notes, Team, ClientPortal, Sidebar

## Features Built

### CSV Bulk Client Import - 2026-06-03
- Installed `papaparse` for secure client-side CSV parsing.
- Added "Import CSV" button next to "+ Add Client" in Dashboard.
- Modal includes template download button, drag-and-drop / click-to-select upload zone, preview table (first 5 rows), required name field validation and warnings, batch insertion (10 rows per batch) with fallback individual insertion for duplicate/policy errors, and progress bars.

### WhatsApp Share Button - 2026-06-03
- Added a WhatsApp share button to each client row in the dashboard next to the Portal link button.
- Fetches the practice name from the `practices` table and stores it in `cachedPracticeName` state.
- Button opens a pre-filled secure portal invitation message via WhatsApp (`https://wa.me/?text=...`).
- Styled with green theme matching branding design specifications: Background `#E7F9EF`, hover background `#D1F5E0`, color `#25D366`, border `1px solid #B7EFD0`.

### Handoff Refresh - 2026-05-31
- Updated this handoff to match the current local files.
- Corrected stale notes that still said staff management, search, routes, and Resend invite email were pending.
- Corrected file paths from old `src/pages/...` structure to the actual flat `src/...` structure.
- Added current `/api/send-invite.js`, `src/Settings.jsx`, routing, Resend SDK, and local command notes.

### Practice Settings Missing Row Fix - 2026-05-31
- `src/Settings.jsx`
  - Replaced practice lookup `.single()` with `.maybeSingle()` to avoid the Supabase "Cannot coerce the result to a single JSON object" error when no practice row exists.
  - If the current user's `users.practice_id` has no matching `practices` row, settings now auto-creates a fallback practice using the current user's email.
  - Existing behavior is preserved when the practice row already exists.
- Build verification:
  - `npm.cmd run build` passed.

### Supabase Safety/Efficiency Audit - 2026-05-31
- Audited Supabase usage across `src/*.jsx`.
- `useEffect` fetch/realtime hooks now have dependency arrays; no render-loop fetch pattern remains.
- Realtime channels in `Messages.jsx` and `ClientPortal.jsx` clean up with `supabase.removeChannel(channel)` on unmount.
- Search remains client-side over already-loaded dashboard clients; it does not query Supabase on every keystroke.
- Replaced broad `select('*')` reads with explicit columns in:
  - `Dashboard.jsx`
  - `Messages.jsx`
  - `Notes.jsx`
  - `ClientPortal.jsx`
  - `Settings.jsx`
  - `Team.jsx`
- `Dashboard.jsx`
  - Client fetch now loads 50 rows at a time with `.range(0, 49)`.
  - Added "Load more clients" button for additional pages.
  - Add/edit/delete/follow-up changes still refresh the client list.
  - Follow-up clear action now handles Supabase errors instead of ignoring them.
- `Messages.jsx`
  - File upload selection and pre-upload guard now reject files over 15MB with `File must be under 15MB`.
- `ClientPortal.jsx`
  - Public portal message posting now rate-limits to 10 messages per 60 seconds in component state.
  - Shows `Please wait a moment before sending more messages.` when the limit is hit.
  - File upload selection and pre-upload guard now reject files over 15MB.
- Build verification:
  - `npm.cmd run build` passed.

### Public Homepage and Policy Pages - 2026-06-12
- `src/PublicPages.jsx`
  - Added a full public marketing homepage for `/` with hero, product preview, feature sections, policy/support links, and CTAs.
  - Added reusable public navigation and footer.
  - Added public information pages:
    - `/privacy`
    - `/privacy-policy`
    - `/terms`
    - `/terms-and-conditions`
    - `/data-usage`
    - `/support`
  - Support page includes `mailto:askinfrons@gmail.com`.
- `src/App.jsx`
  - Replaced the old minimal homepage with `MarketingHome`.
  - Added public routes for privacy policy, terms and conditions, data usage, and support.
  - Preserved existing auth behavior: logged-in users visiting `/` still redirect to `/dashboard`.
  - Protected app routes, client portal, settings, and team routing remain unchanged.
- Build verification:
  - `npm.cmd run build` passed on 2026-06-12.
  - Static route check confirmed all new routes are wired in `App.jsx`.
  - Attempted to start Vite as a detached local process for browser route checks, but the managed sandbox blocked detached process creation. Running `npm.cmd run dev -- --host 127.0.0.1 --port 5173` directly starts Vite correctly.

### Environment Exposure Hardening - 2026-06-12
- `.gitignore`
  - Now ignores `.env.*` files and keeps `!.env.example` available if a safe template is added later.
  - Existing `.env`, `.env.local`, and `.env.production` remain ignored.
- `api/send-invite.js`
  - Removed `VITE_RESEND_API_KEY` fallback.
  - Resend now reads only server-side `process.env.RESEND_API_KEY`.
- `src/PublicPages.jsx`
  - Removed public support-page mention of `RESEND_API_KEY` so implementation env names are not exposed in the frontend bundle.
- Verification:
  - `npm.cmd run build` passed.
  - `node --check api\send-invite.js` passed.
  - Scanned `dist/` for `.env` files: none found.
  - Scanned `dist/` for `RESEND_API_KEY`, `VITE_RESEND_API_KEY`, and `re_` key-like markers: none found.
  - Scanned `dist/` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` variable names: none found.
- Note:
  - Supabase `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are frontend values by design. The anon key is public in Supabase apps and must be protected by RLS policies, not treated like a server secret.

### Practice RLS Insert Guard - 2026-06-13
- `src/Settings.jsx`
  - Fixed the practice settings fallback so only the principal owner can auto-create a missing `practices` row.
  - Staff users no longer attempt to upsert into `practices`; they see: `Practice profile is missing. Please ask the principal account to open Settings.`
  - This avoids triggering `new row violates row-level security policy for table "practices"` for staff users.
- `practice_rls_policies.sql`
  - Added helper SQL for safe `practices` RLS:
    - authenticated users can insert only their own practice where `id = auth.uid()`
    - practice members can read their practice through `users.practice_id`
    - principal owners can update their own practice
- Build verification:
  - `npm.cmd run build` passed.

### Staff Management Build - 2026-05-30
- `src/Team.jsx`
  - Team page now loads practice members and shows client assignment counts per member.
  - Staff invite button is shown only to principal users.
  - Invite modal now supports copying a prefilled invite link for manual sharing.
  - Invite email now calls `/api/send-invite` instead of sending directly from the browser, so the Resend key is not exposed to users.
  - If email sending fails, the UI tells the user they can still copy and send the invite link manually.
- `api/send-invite.js`
  - Added Vercel serverless endpoint for Resend invite emails.
  - Reads `RESEND_API_KEY` first, with `VITE_RESEND_API_KEY` as a fallback for the current local setup.
  - Uses Resend's `onboarding@resend.dev` sender for now; production should switch to a verified sending domain.
- `src/Signup.jsx`
  - Staff invite signup links can now prefill name and email from URL params.
  - Invited users still create `users` rows with `role: 'staff'` and the invited `practice_id`.
- `src/Dashboard.jsx`
  - Client edit modal now preserves `assigned_to`; previously editing a client could drop the assignment from the form state.
  - Principal users now see "Assigned to ..." under client rows when a client has a staff assignee.
  - Staff users still only see clients assigned to them.
- Build verification:
  - `npm.cmd run build` passed on 2026-05-30.
  - First `npm run build` attempt was blocked by Windows PowerShell execution policy; using `npm.cmd` works.

### Resend / Environment Note
- The user added a Resend key to `.env`.
- Recommended production env var name is `RESEND_API_KEY` because email is now sent server-side.
- Keep `VITE_RESEND_API_KEY` out of browser code going forward.
- Add the same key to Vercel environment variables before deployed invites can send email.

### Resend SDK Update - 2026-05-30
- Installed official `resend` npm package.
- `api/send-invite.js` now uses `import { Resend } from 'resend'` and `resend.emails.send(...)` instead of raw `fetch`.
- `.gitignore` now excludes `.npm-cache`, which was used because Windows denied npm's default cache folder.
- Build verification:
  - `npm.cmd run build` passed.
  - `node --check api\send-invite.js` passed.
- Important:
  - Do not hardcode `re_xxxxxxxxx` in frontend or committed source.
  - Replace `re_xxxxxxxxx` with the real Resend API key in local `.env` as `RESEND_API_KEY=...`.
  - Add the same `RESEND_API_KEY` in Vercel environment variables for production.

### Routing Build - 2026-05-30
- `src/App.jsx`
  - Added full React Router route map:
    - `/` public homepage, redirects logged-in users to `/dashboard`
    - `/login` public, redirects logged-in users to `/dashboard`
    - `/signup` public, redirects logged-in users to `/dashboard`
    - `/dashboard` protected main client list
    - `/clients` protected alias for dashboard
    - `/client/:id/messages` protected messaging thread
    - `/client/:id/notes` protected private notes
    - `/portal/:token` public client portal
    - `/settings` protected practice settings
    - `/settings/team` protected principal-only team page
    - `/404` public not found page
    - `*` redirects to `/404`
  - Added `ProtectedRoute` using `supabase.auth.getSession()`.
  - Added principal-only routing by checking the `users.role` row.
  - Added `PublicRedirect` for homepage/login/signup.
  - Added full-screen white loading spinner with infrons wordmark and rotating circle.
  - Kept old `/team` route as a redirect to `/settings/team` to avoid breaking existing links.
- `src/Settings.jsx`
  - Added simple protected practice settings page showing practice name, email, and current user role.
  - Principal users can navigate to team management from settings.
- `src/Sidebar.jsx`
  - Clients navigation now points to `/clients` and treats `/dashboard` as active too.
  - Added Practice settings nav item.
  - Team nav now points to `/settings/team`.
- Build verification:
  - `npm.cmd run build` passed.
  - `node --check` is not applicable to `.jsx` files in this setup; Vite build is the route/JSX verification.

## Current State

### What's Built ✅
1. **Authentication System**
   - Login page with Supabase Auth
   - Signup page that creates:
     - Auth user
     - Practice record in `practices` table
     - User profile in `users` table
   - Proper session checking and redirects

2. **Dashboard with Full Client Management**
   - Fetches all clients for logged-in practice
   - "Add Client" button → modal with name, company, phone fields
   - Client list with status indicators (green/yellow/red dots based on `last_client_reply`)
   - Status logic:
     - Green: replied within 2 days
     - Yellow: 3-5 days since reply
     - Red: 6+ days or never replied
   - Auto-sorts clients by last_client_reply (red/unresponsive clients at top)
   - Edit client: click name to open modal with pre-filled data
   - Delete client: confirmation prompt before deletion
   - Navigation buttons: Chat, Notes
   - WhatsApp share button to invite clients to their secure portal link
   - CSV Bulk Import: upload, preview, parse client-side with PapaParse, and batch-insert clients from a template CSV
   - Search filters by name, company, and phone
   - Principal users can assign clients to staff
   - Staff users only see clients assigned to them
   - Auto-creates missing practice records for existing users

3. **Staff Management**
   - Team page at `/settings/team`
   - Principal-only route guard
   - Invite staff by email through Resend server endpoint
   - Copy invite link fallback
   - Staff signup joins existing practice via invite `practice_id`
   - Team table shows assigned client counts

4. **Routing**
   - Public routes: `/`, `/login`, `/signup`, `/portal/:token`, `/404`
   - Protected routes: `/dashboard`, `/clients`, `/client/:id/messages`, `/client/:id/notes`, `/settings`
   - Principal-only protected route: `/settings/team`
   - Old `/team` route redirects to `/settings/team`
   - Logged-in users are redirected away from `/`, `/login`, `/signup` to `/dashboard`
   - Unknown routes redirect to `/404`

5. **Practice Settings**
   - Settings page at `/settings`
   - Shows practice name, practice email, and current user role

6. **Database Schema (Supabase)**
   Tables created:
   - `practices`: id, name, email, created_at
   - `users`: id, practice_id, full_name, role (principal/staff), created_at
   - `clients`: id, practice_id, assigned_to, name, company, email, phone, portal_token, last_client_reply, follow_up_date, created_at
   - `messages`: id, client_id, sender (ca/client), content, file_url, file_name, is_read, created_at
   - `notes`: id, client_id, user_id, content, created_at

7. **Row-Level Security (RLS) Policies**
   Full RLS implemented for:
   - practices (users can only access their own)
   - users (practice-scoped access)
   - clients (practice-scoped CRUD)
   - messages (practice-scoped via client relationship)
   - notes (practice-scoped via client relationship)

### What's NOT Built Yet
- Automated email notifications for new messages and follow-up reminders
- Production verified Resend sending domain

## Files Actively Edited

### Core Files
- `src/App.jsx` — React Router setup, protected routes, public redirects, loading spinner, homepage, 404 page
- `src/Dashboard.jsx` — Main client management interface
- `src/Login.jsx` — Authentication login
- `src/Signup.jsx` — New practice signup and staff invite signup
- `src/Messages.jsx` — Client messaging thread
- `src/Notes.jsx` — Private notes
- `src/ClientPortal.jsx` — Public client portal
- `src/Settings.jsx` — Practice settings
- `src/Team.jsx` — Team management and staff invites
- `src/Sidebar.jsx` — App navigation
- `src/supabaseClient.js` — Supabase initialization
- `api/send-invite.js` — Vercel serverless Resend invite endpoint

### Configuration Files
- `package.json` — Dependencies including @tailwindcss/postcss and resend
- `postcss.config.js` — PostCSS with @tailwindcss/postcss plugin
- `tailwind.config.js` — Tailwind v4 configuration
- `vite.config.js` — Vite build config
- `.env` — Supabase credentials
- `vercel.json` — SPA routing config

## Issues Encountered & Solutions

### 1. Tailwind CSS PostCSS Plugin Error ❌ → ✅
**Error**: "It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin"

**Cause**: Tailwind v4 moved PostCSS integration to separate package

**Solution**: 
- Added `@tailwindcss/postcss` to dependencies
- Updated `postcss.config.js` to use `'@tailwindcss/postcss'` instead of `tailwindcss`

### 2. Foreign Key Constraint on Client Insert ❌ → ✅
**Error**: "insert or update on table 'clients' violates foreign key constraint 'clients_practice_id_fkey'"

**Cause**: User accounts existed without corresponding practice records (signup failed silently or users created before practice insertion was added)

**Solution**: 
- Added auto-creation logic in Dashboard.jsx `fetchClients()`
- Checks if practice exists, creates it if missing using user's email
- Now gracefully handles legacy accounts

### 3. Row-Level Security Blocking Inserts ❌ → ✅
**Error**: "new row violates row-level security policy for table 'practices'"

**Cause**: RLS was enabled but no policies existed to allow authenticated users to insert their own records

**Solution**: Created comprehensive RLS policies via SQL:
- practices: users can insert/view/update their own practice (WHERE auth.uid() = id)
- users: users can insert their own profile, view practice team members
- clients: practice-scoped CRUD (WHERE practice_id = auth.uid())
- messages: practice-scoped via client foreign key relationship
- notes: practice-scoped via client foreign key, user can only update/delete their own

### 4. Status Colors Not Showing ⚠️ (Expected Behavior)
**Issue**: All clients show red dots after creation

**Cause**: New clients have `last_client_reply = NULL` by default

**Expected**: This is correct behavior. Colors will populate once:
- Messages feature is built and clients send replies
- `last_client_reply` gets updated automatically
- Or manually set timestamps in Supabase for testing

**No action needed** — working as designed

### 5. Loading State Stuck on "Loading..." ❌ → ✅
**Cause**: No auth session check, no error handling

**Solution**:
- Added `checkAuth()` function to verify session on mount
- Redirects to login if no session
- Shows error messages on screen instead of just console
- Added proper loading state management

## What We Tried That Failed

### 1. Using `npx tailwindcss init` ❌
**What happened**: Command failed with npm error
**Why**: Tailwind v4 CLI not available in node_modules bin
**Workaround**: Created config files manually

### 2. Copying Full Project with `cp -r` ❌
**What happened**: Command timed out
**Why**: node_modules too large
**Solution**: Used `zip` with `--exclude node_modules` instead

### 3. Running Dev Server in Background ❌
**What happened**: `npm run dev &` exceeded execution time limit
**Why**: Can't run long-lived processes in this environment
**Solution**: User runs locally, we only provide source files

### 4. Using `view` Before `str_replace` Initially ❌
**What happened**: Tried to str_replace without viewing current content first
**Why**: Need to see exact string format including line numbers
**Learning**: Always `view` before `str_replace`, and re-view after successful edits

## Next Steps (Priority Order)

1. **Test Staff Invite Flow End-to-End**
   - Add `RESEND_API_KEY` to local `.env` and Vercel
   - Use `vercel dev` or deployed Vercel app to test `/api/send-invite`
   - Confirm staff signup can insert a `users` row under the invited practice

2. **Email Notifications**
   - Send emails when a new message is received or follow-up is due

3. **Production Email Setup**
   - Add and verify a real sending domain in Resend
   - Replace `onboarding@resend.dev` sender after domain verification

## Design Constraints (Must Follow)
- White background always
- Clean minimal UI — no dark themes
- Mobile-first responsive design
- WhatsApp-style messaging bubbles
- Maximum 3 elements per screen
- No bloat, no unnecessary features

## Environment Variables (Vercel)
```
VITE_SUPABASE_URL=https://egctgqjdjhvkjnqabxtr.supabase.co
VITE_SUPABASE_ANON_KEY=[from .env file]
RESEND_API_KEY=[Resend API key, server-side only]
```

## Local Development Commands
```bash
npm install
npm run dev          # Start Vite dev server
npm.cmd run build    # Build for production on this Windows machine
vercel dev           # Run Vite plus /api serverless routes locally
```

## Current File Structure
```
infrons-project/
.env
.gitignore
api/
  send-invite.js
package.json
package-lock.json
postcss.config.js
tailwind.config.js
vite.config.js
vercel.json
index.html
README.md
src/
  index.css
  main.jsx
  App.jsx
  supabaseClient.js
  Login.jsx
  Signup.jsx
  Dashboard.jsx
  Messages.jsx
  Notes.jsx
  ClientPortal.jsx
  Settings.jsx
  Team.jsx
  Sidebar.jsx
```

## Key Code Patterns

### Supabase Query Pattern
```javascript
const { data: { user } } = await supabase.auth.getUser()

const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('practice_id', user.id)

if (error) {
  setError(error.message)
  return
}
```

### Status Color Logic
```javascript
const getStatusColor = (lastReply) => {
  if (!lastReply) return 'bg-red-500'
  const daysSince = Math.floor((Date.now() - new Date(lastReply).getTime()) / (1000 * 60 * 60 * 24))
  if (daysSince <= 2) return 'bg-green-500'
  if (daysSince <= 5) return 'bg-yellow-500'
  return 'bg-red-500'
}
```

## Notes for Next Developer
- User is Anshul, prefers brief explanations with no filler
- Keep responses professional and to the point
- Status colors are working correctly (waiting for message data)
- RLS policies are fully configured and tested
- Auto-practice-creation handles legacy accounts gracefully
- `src/` files are flat, not inside `src/pages/`
- Use `npm.cmd run build` in PowerShell if `npm run build` is blocked by execution policy
