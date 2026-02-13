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
