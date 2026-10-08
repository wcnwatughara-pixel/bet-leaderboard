# Session 3 Handover

## What was done

### v3 Simplification (all complete, build verified)

1. **Stripped leagues entirely** - Deleted 5 league pages, removed all league CSS, removed league activity logging, cleaned all imports. Old league URLs redirect to home.

2. **Restructured navigation** - BottomNav is now simple NavLinks: Home, Log Bets, My Bets, Admin (admin only), More. No overlay menu.

3. **Rebuilt Session 2 features** - Pending bets (outcome='pending'), settle flow with modal, batch bet entry (up to 10 rows), all in LogBetPage and MyBetsPage.

4. **Built admin review queue** - AdminPage has Review tab as default. All new bets show for admin review. Admin can approve or flag with predefined reasons. Flagged bets excluded from leaderboard. User gets notification on flag/unflag.

5. **Built notifications** - MorePage shows notification list with unread badge, mark read, mark all read. insert_notification() RPC for cross-user inserts.

6. **Built Shared Bets feed** - Home page (LeaderboardPage) now has two tabs: Leaderboard and Shared Bets. Users can share bets from My Bets page. Pre-result and post-result types. Community confirmations. Owner can mark outcome.

7. **Built More page** - Notifications section, profile section (username, join date), log out button.

8. **GitHub Actions keep-alive cron** - `.github/workflows/keep-alive.yml` pings Supabase every 4 days. Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` secrets in GitHub.

9. **CSS overhaul** - Removed all league styles, old menu overlay. Added styles for: modals, pending/flagged bet states, batch form, notifications, review queue, profile card, shared bets feed, share modal.

## What needs to happen before deploy

### 1. Run SQL migration
Open Supabase SQL Editor, paste the contents of `sql/v3-migration.sql`, and run with `SET ROLE postgres;` at the top.

This adds:
- `pending` outcome + `settled_at` column on bets
- Admin flagging columns on bets (is_flagged, flag_reason, etc.)
- `shared_bets` + `shared_bet_confirmations` tables
- `notifications` table + `insert_notification()` RPC
- Performance indexes
- Admin RLS policies + `is_admin()` helper

### 2. Push code to GitHub
Wesley needs to generate a fresh GitHub token (repo scope, 7-day expiry) and push the code. Vercel auto-deploys from main.

### 3. Set GitHub Actions secrets
In the GitHub repo settings, add:
- `SUPABASE_URL`: `https://tpdeqvaprmmpdhgwkjvw.supabase.co`
- `SUPABASE_ANON_KEY`: (the anon/public key from Supabase dashboard)

## Files changed/created this session

### Created
- `src/pages/MorePage.jsx` - Notifications + Profile + Logout
- `sql/v3-migration.sql` - Combined DB migration
- `.github/workflows/keep-alive.yml` - Supabase keep-alive cron

### Rewritten
- `src/App.jsx` - Removed league routes, added /more route
- `src/components/BottomNav.jsx` - Simple NavLink nav (no overlay)
- `src/components/BetRow.jsx` - Pending/flagged states, settle/share actions
- `src/pages/LeaderboardPage.jsx` - Two tabs: Leaderboard + Shared Bets feed
- `src/pages/LogBetPage.jsx` - Single/Batch mode with pending outcome
- `src/pages/MyBetsPage.jsx` - Pending section, settle modal, share modal
- `src/pages/AdminPage.jsx` - Review Queue tab, rewritten Flags tab
- `src/index.css` - Full v3 CSS (leagues removed, new components added)

### Deleted
- `src/pages/ActivityLogPage.jsx`
- `src/pages/leagues/BrowseLeaguesPage.jsx`
- `src/pages/leagues/CreateLeaguePage.jsx`
- `src/pages/leagues/JoinLeaguePage.jsx`
- `src/pages/leagues/LeagueDetailPage.jsx`
- `src/pages/leagues/MyLeaguesPage.jsx`

## Tech stack (unchanged)
- React (Vite) frontend, mobile-first (480px max)
- Supabase backend at tpdeqvaprmmpdhgwkjvw.supabase.co
- Vercel hosting at bet-leaderboard.vercel.app
- GitHub repo: wcnwatughara-pixel/bet-leaderboard
