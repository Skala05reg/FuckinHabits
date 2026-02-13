# Context Log

## 2026-02-13 23:52 MSK

### Reliability and Delivery
- Unified cron authentication with a shared helper (`Authorization: Bearer <CRON_SECRET>` plus backward-compatible `x-cron-secret`) in `/Users/vodnik/Desktop/FuckinHabits/src/lib/cron-auth.ts`.
- Added `GET` handlers for cron routes that were previously `POST`-only, so Vercel Cron can execute them directly:
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/remind/route.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/remind-missing/route.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/check-birthdays/route.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/hourly/route.ts`
- Fixed broken `curl` multiline syntax in `/Users/vodnik/Desktop/FuckinHabits/.github/workflows/cron.yml`.

### Metrics/Data Alignment
- Fixed streak calculation anchor in `/Users/vodnik/Desktop/FuckinHabits/src/app/api/stats/summary/route.ts`: current streak now anchors to `toDate` instead of always using today.
- Added strict query validation for heatmap metric params in `/Users/vodnik/Desktop/FuckinHabits/src/app/api/stats/heatmap/route.ts`.
- Fixed brittle birthday date matching logic by parsing ISO `YYYY-MM-DD` directly instead of locale/date-object conversions in `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/check-birthdays/route.ts`.

### Config and Architecture Hygiene
- Introduced centralized runtime config in `/Users/vodnik/Desktop/FuckinHabits/src/config/app.ts`.
- Moved LLM prompt templates out of business files into `/Users/vodnik/Desktop/FuckinHabits/src/config/agent-prompts.ts`.
- Added reusable date/time helpers in `/Users/vodnik/Desktop/FuckinHabits/src/lib/date-time.ts`.
- Connected config constants to API/auth/digest/date logic across routes and libs.

### Security and Hardening
- Hardened auth mock parsing in `/Users/vodnik/Desktop/FuckinHabits/src/lib/api-auth.ts` (safe integer validation for mock telegram ids).
- Reduced sensitive/noisy runtime logging in `/Users/vodnik/Desktop/FuckinHabits/src/lib/supabase.ts`.
- Tightened production behavior for Google credentials parsing in `/Users/vodnik/Desktop/FuckinHabits/src/lib/google-calendar.ts`.

### Frontend Quality
- Replaced several raw `fetch` calls with unified `apiFetch` in `/Users/vodnik/Desktop/FuckinHabits/src/components/app-shell.tsx` to keep auth/tz/mock behavior consistent.
- Fixed top nav grid layout (`grid-cols-4`) for the 4 main buttons in `/Users/vodnik/Desktop/FuckinHabits/src/components/app-shell.tsx`.
- Fixed Telegram BackButton cleanup callback handling in `/Users/vodnik/Desktop/FuckinHabits/src/app/birthdays/page.tsx`.

### Validation Status
- `npm run lint`: passed.
- `npm run build`: passed.
- Deployment to Vercel is currently blocked in this environment due invalid/missing CLI auth token.

### Git push note
- Changes were pushed to `origin/main`.
- `.github/workflows/cron.yml` improvement was reverted before final push due GitHub credential restriction (`workflow` scope missing for PAT on this machine).
