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

## 2026-02-14 00:00 MSK

### Security hardening
- Added optional Telegram webhook secret verification in `/Users/vodnik/Desktop/FuckinHabits/src/lib/webhook-auth.ts` and enforced it in `/Users/vodnik/Desktop/FuckinHabits/src/app/api/webhook/route.ts`.
- Webhook now returns `401` for invalid secret when `TELEGRAM_WEBHOOK_SECRET` is configured.

### Data quality and metric consistency
- Fixed summary aggregation to count `daysWithAnyCompletion` from all real completion events in range (not only from currently active habits):
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/stats/summary/route.ts`
- Fixed heatmap `metric=habits` denominator source to include all user habits (active + inactive), preventing historical distortion after deactivations:
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/stats/heatmap/route.ts`

### Birthdays quality pass
- Added strict `zod` validation for birthday create/update payloads and tightened selected fields in responses:
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/birthdays/route.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/birthdays/[id]/route.ts`
- Removed timezone-sensitive `new Date(YYYY-MM-DD)` parsing from birthdays UI and replaced with deterministic ISO month/day parsing:
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/birthdays/page.tsx`

### Config updates
- Added `TELEGRAM_WEBHOOK_SECRET` to `/Users/vodnik/Desktop/FuckinHabits/.env.example`.

### Validation status
- `npm run lint`: passed.
- `npm run build`: passed.
- `vercel --prod` and `vercel logs`: blocked due missing/invalid CLI credentials in this environment.

## 2026-02-14 00:05 MSK

### Cron performance and reliability refactor
- Added batched async executor to control cron parallelism:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/async.ts`
- Switched cron routes to bounded batch processing using config-driven limits:
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/hourly/route.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/remind/route.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/remind-missing/route.ts`
- Removed heavy N+1 query pattern from missing-reminders flow by loading date ranges once per user and evaluating in memory.

### Security and auth hardening
- Telegram Mini App bypass auth is now production-gated unless explicitly allowed by env:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/api-auth.ts`
- Webhook secret validation switched to constant-time comparison:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/webhook-auth.ts`

### Code quality cleanup
- Removed unnecessary `any` usage and noisy runtime classification logs in bot flow:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/bot.ts`
- Removed `any` cast from calendar client creation:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/google-calendar.ts`

### Config/documentation sync
- Added new runtime config knobs:
  - `CRON_PROCESS_BATCH_SIZE`
  - `REMIND_MISSING_LOOKBACK_DAYS`
  - `TELEGRAM_BYPASS_AUTH_ALLOW_PROD`
- Updated config templates/docs:
  - `/Users/vodnik/Desktop/FuckinHabits/.env.example`
  - `/Users/vodnik/Desktop/FuckinHabits/README.md`

### Validation status
- `npm run lint`: passed.
- `npm run build`: passed.
- Vercel deploy/log checks: blocked by missing/invalid credentials in current environment.

## 2026-02-14 00:10 MSK

### Additional delivery-quality refactor
- Added shared day-data presence helper to remove duplicated logic and keep reminder behavior consistent:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/db/day-data.ts`
  - integrated in `/Users/vodnik/Desktop/FuckinHabits/src/lib/features/reminders.ts`
  - integrated in `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/remind/route.ts`

### Security hardening
- Cron secret checks are now constant-time and more robust Bearer parsing:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/cron-auth.ts`
- Webhook secret constant-time compare remained active from prior pass.

### Config hygiene
- Added `DEFAULT_EVENT_DURATION_MINUTES` and used it instead of hardcoded `30` in bot timed-event creation:
  - `/Users/vodnik/Desktop/FuckinHabits/src/config/app.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/bot.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/.env.example`
  - `/Users/vodnik/Desktop/FuckinHabits/README.md`

### Code cleanup
- Removed additional `any` pressure points and noisy classification logging in bot flow:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/bot.ts`
- Simplified calendar client auth typing:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/google-calendar.ts`

### Validation status
- `npm run lint`: passed.
- `npm run build`: passed.
- Vercel deploy/logs remain blocked by invalid/missing credentials in current environment.

## 2026-02-16 17:02 MSK

### Bot task-list delivery fix
- Fixed core issue where requests like “покажи задачи на сегодня” were often falling through to journal.
- Added fast-path keyword detection for task-list queries in `/Users/vodnik/Desktop/FuckinHabits/src/config/bot.ts` and wired it in `/Users/vodnik/Desktop/FuckinHabits/src/lib/bot.ts` before LLM classification.
- Changed `get_events` handling to default date = today when classifier does not provide `scheduleDetails.date`.

### New bot UX for tasks
- Added commands `/tasks` and `/today` to immediately show today’s task list in Telegram.
- Added explicit inline button “Показать задачи на сегодня” in `/start` message.
- Unified callback constants and labels into config (`/Users/vodnik/Desktop/FuckinHabits/src/config/bot.ts`).

### Morning 09:00 task list and deduplication
- Reworked daily digest to use a shared task-list sender:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/features/task-lists.ts` (new)
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/features/digest.ts` (wrapper)
- Hourly cron (`/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/hourly/route.ts`) now sends the same list format at digest time.
- Added anti-duplicate behavior: before sending a new list, all previously tracked task-list messages are deleted.

### Persistence for duplicate-control
- Added DB table for tracked bot list messages:
  - migration: `/Users/vodnik/Desktop/FuckinHabits/supabase/migrations/20260216000000_add_bot_messages.sql`
  - schema sync: `/Users/vodnik/Desktop/FuckinHabits/supabase/schema.sql`
  - helpers: `/Users/vodnik/Desktop/FuckinHabits/src/lib/db/bot-messages.ts`
- Added fail-open compatibility when migration is not yet applied (missing `bot_messages` table no longer causes 500).

### Config and docs hygiene
- Added config key `MAX_TRACKED_TASK_LIST_MESSAGES`.
- Added config key `DEFAULT_EVENT_DURATION_MINUTES` usage in bot timed event creation.
- Updated env/docs:
  - `/Users/vodnik/Desktop/FuckinHabits/.env.example`
  - `/Users/vodnik/Desktop/FuckinHabits/README.md`

### Deployment status
- Deployed production build successfully:
  - `https://fuckin-habits.vercel.app`
  - deployment: `https://fuckin-habits-p24a5p6wx-olegstroganov04-gmailcoms-projects.vercel.app`
- Post-deploy checks:
  - `GET /` => `200`
  - `GET /api/cron/hourly` without auth => `401` (expected)
- Recent production logs: no runtime `500` entries in checked window.

## 2026-02-16 17:04 MSK

### Finalization updates
- Reviewed new `.gitignore` entry `.env*.local` created after Vercel link setup and kept it as correct (covers all local env variants, prevents accidental secret leaks).
- Re-ran validation on current tree:
  - `npm run lint` => passed
  - `npm run build` => passed
- Confirmed refactor set is ready for commit/push without additional business-logic changes.

## 2026-02-16 17:09 MSK

### Release and verification
- Committed refactor package to `main`:
  - commit: `bd03f32`
  - message: `refactor(bot): stabilize task-list flow and digest dedupe`
- Pushed to GitHub:
  - `origin/main` updated from `732155d` to `bd03f32`.
- Triggered production deployment in Vercel and verified latest deployment state:
  - deployment: `https://fuckin-habits-glza78i6p-olegstroganov04-gmailcoms-projects.vercel.app`
  - state: `READY`
  - commit sha on deployment: `bd03f32486c6b0ae6973207ac25a5ddcd077d473`
- Production checks:
  - `GET https://fuckin-habits.vercel.app` => `200`
  - production logs for recent window => no `500` entries.

## 2026-05-12 09:40 MSK

### Shared Telegram Mini App router
- Kept `FuckinHabits` as the primary Telegram bot router for the shared bot:
  - the single Telegram webhook points to `https://fuckin-habits.vercel.app/api/webhook`;
  - the standard Telegram menu button opens the primary Mini App at `https://fuckin-habits.vercel.app`;
  - `/start` now renders multiple Mini App buttons from env-backed links.
- Added PMW admin Mini App support:
  - `PMW_ADMIN_WEBAPP_URL=https://pussy-money-weed.vercel.app/telegram-admin`;
  - the PMW admin button is rendered in `/start` whenever `PMW_ADMIN_WEBAPP_URL` is configured;
  - PMW itself performs the Telegram `initData` HMAC and admin allowlist checks.
- Added shared Mini App link helper:
  - `src/lib/telegram/mini-apps.ts`;
  - `/start` combines Mini App buttons with the existing `show_tasks_today` callback button.
- Preserved the newer webhook hardening from `origin/main`:
  - `src/app/api/webhook/route.ts` uses `validateTelegramWebhookSecret`;
  - production `TELEGRAM_WEBHOOK_SECRET` was rotated and the Telegram webhook was updated with the same secret token.

### Verification
- `npm run build` passed locally after rebase conflict resolution.
- Commit pushed to GitHub:
  - commit: `efd1869`;
  - message: `Add shared mini app bot menu`.
- Vercel production deployment:
  - deployment: `dpl_3Xr6HuuyWipUcAUi25njm5KDZPjH`;
  - URL: `https://fuckin-habits-nup5cqtqy-olegstroganov04-gmailcoms-projects.vercel.app`;
  - state: `READY`;
  - production alias: `https://fuckin-habits.vercel.app`.
- Telegram Bot API configuration:
  - `setWebhook` now points to `https://fuckin-habits.vercel.app/api/webhook`;
  - `getWebhookInfo` reports `pending_update_count=0`, allowed updates `message, callback_query`, and no last error;
  - `setChatMenuButton` points the default menu button to `https://fuckin-habits.vercel.app/`.
- Smoke checks:
  - `POST https://fuckin-habits.vercel.app/api/webhook` without Telegram secret => `401` expected;
  - `GET https://fuckin-habits.vercel.app/?smoke=shared-miniapp` => `200`.

## 2026-05-12 10:35 MSK

### PMW button visibility fix
- Root cause of the missing PMW `/start` button was not Telegram-side:
  - `src/lib/telegram/mini-apps.ts` filtered PMW button visibility by `PMW_ADMIN_TELEGRAM_IDS` / `TELEGRAM_ADMIN_IDS`;
  - the shared bot was working, but the current Telegram user ID was not passing that router-level filter.
- Simplified the shared bot router:
  - `/start` now always shows the PMW Mini App button when `PMW_ADMIN_WEBAPP_URL` is set;
  - access control remains enforced only inside PMW through Telegram `initData` verification and `TELEGRAM_ADMIN_IDS`.
- Removed the now-unused `PMW_ADMIN_TELEGRAM_IDS` example from `README.md` and `.env.example`.
