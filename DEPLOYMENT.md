# Deployment Guide

## ✅ What's Been Built

### Features Completed
1. **Authentication**
   - Login/Signup with Supabase Auth
   - Session management with auto-redirect

2. **Dashboard**
   - View all clients with status indicators
   - Add/Edit/Delete clients
   - Status colors: Green (0-2 days), Yellow (3-5 days), Red (6+ days or no reply)
   - Auto-sorts by urgency

3. **Messages Page** ✨ NEW
   - WhatsApp-style chat bubbles
   - CA messages: Blue (right-aligned)
   - Client messages: Gray (left-aligned)
   - Real-time message updates via Supabase Realtime
   - Auto-scrolls to latest message
   - Timestamps in Indian format

4. **Notes Page** ✨ NEW
   - Internal CA notes (not visible to clients)
   - Create/Edit/Delete notes
   - Shows author name and timestamp
   - Only note author can edit/delete their notes

### Database Trigger ✨ NEW
- Auto-updates `last_client_reply` timestamp when clients send messages
- Keeps dashboard status colors accurate
- **Must be run in Supabase SQL Editor** (see step 3 below)

## 🚀 Deployment Steps

### 1. Run Database Trigger (REQUIRED)
Open Supabase SQL Editor and run:
```sql
-- Copy entire content from database/trigger_last_client_reply.sql
-- This auto-updates client status when they reply
```

### 2. Local Testing
```bash
npm install
npm run dev
```

### 3. Deploy to Vercel

**Option A: Via GitHub**
1. Push code to GitHub
2. Import repository in Vercel
3. Add environment variables:
   ```
   VITE_SUPABASE_URL=https://egctgqjdjhvkjnqabxtr.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key-from-.env>
   ```
4. Deploy

**Option B: Via Vercel CLI**
```bash
npm install -g vercel
vercel
# Follow prompts, add env variables when asked
```

## 🔑 Environment Variables

Copy from `.env` file:
- `VITE_SUPABASE_URL` → Supabase project URL
- `VITE_SUPABASE_ANON_KEY` → Supabase anonymous key

## ✅ Testing Checklist

### Authentication
- [ ] Signup creates practice + user profile
- [ ] Login redirects to dashboard
- [ ] Protected routes redirect to login

### Dashboard
- [ ] View all clients
- [ ] Add new client
- [ ] Edit client details
- [ ] Delete client with confirmation
- [ ] Status colors show correctly

### Messages
- [ ] Send messages as CA
- [ ] Messages appear in chat
- [ ] Timestamps display correctly
- [ ] Real-time updates work
- [ ] Scroll to bottom on new message

### Notes
- [ ] Add new note
- [ ] Edit own notes
- [ ] Delete own notes
- [ ] Cannot edit/delete others' notes
- [ ] Author name displays

## 🎯 Next Features (Not Built Yet)

1. **Client Portal** (`/portal/:token`)
   - Public access via unique link
   - Clients can view and reply to messages
   - No login required

2. **File Upload**
   - Attach files to messages
   - Download/preview files
   - Use Supabase Storage

3. **Email Notifications**
   - Notify clients of new messages
   - Follow-up reminders

4. **Staff Management**
   - Add team members to practice
   - Assign clients to staff

## 🐛 Troubleshooting

### Messages not updating in real-time?
- Check Supabase Realtime is enabled for `messages` table
- Verify RLS policies allow SELECT on messages

### Status colors stuck on red?
- Run the database trigger (step 1)
- Manually test by inserting a message with sender='client'

### "Row-level security" errors?
- Verify all RLS policies are enabled
- Check user is authenticated

## 📁 Project Structure
```
infrons-project/
├── database/
│   └── trigger_last_client_reply.sql  ← Run in Supabase
├── src/
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Messages.jsx              ← NEW
│   │   └── Notes.jsx                 ← NEW
│   ├── App.jsx
│   ├── supabaseClient.js
│   └── main.jsx
├── .env                               ← Add your keys
├── package.json
└── vercel.json
```

## 💡 Tips

- **Mobile First**: UI is optimized for mobile devices
- **Real-time**: Messages auto-update via Supabase channels
- **Clean UI**: White background, minimal design, no bloat
- **Status Logic**: Auto-sorts clients by urgency (red/yellow/green)
