## 2026-02-13 23:52:57 MSK (+0300)

### Scope completed this run
- Full repository audit across backend routes, cron jobs, metrics endpoints, bot/calendar logic, UI layer, and docs/config files.
- Refactor-only changes (no intentional hardcore business logic rewrites), focused on delivery quality, consistency, security, and metric correctness.

### Key findings and what was refactored
1. Cron execution mismatch and auth fragmentation:
- Found: `vercel.json` cron jobs trigger `GET`, but several cron routes were `POST`-only and used different auth headers.
- Done: Introduced shared cron auth helper (`/Users/vodnik/Desktop/FuckinHabits/src/lib/cron-auth.ts`) and added `GET` compatibility to cron handlers.

2. Broken GitHub Actions curl command:
- Found: multiline `curl` in `/Users/vodnik/Desktop/FuckinHabits/.github/workflows/cron.yml` was syntactically broken.
- Done: Fixed command with proper line continuations and `--fail --show-error --silent`.

3. Date parsing bug in birthday reminders:
- Found: locale/date-object parsing could shift day/month depending on timezone parsing behavior.
- Done: Replaced with deterministic ISO date parsing (`YYYY-MM-DD`) in `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/check-birthdays/route.ts`.

4. Metrics consistency issue in streaks:
- Found: current streak in summary endpoint always anchored to logical “today”, not requested `toDate`.
- Done: anchored current streak to `toDate` in `/Users/vodnik/Desktop/FuckinHabits/src/app/api/stats/summary/route.ts`.

5. Heatmap query validation weakness:
- Found: metric query parameter accepted loose cast values.
- Done: added strict zod validation for metric/habitId in `/Users/vodnik/Desktop/FuckinHabits/src/app/api/stats/heatmap/route.ts`.

6. Config sprawl and hardcoded parameters/prompts:
- Found: distributed magic values (times, limits, token counts, truncation sizes, etc.) and prompt text inside agent logic.
- Done:
  - Added centralized config: `/Users/vodnik/Desktop/FuckinHabits/src/config/app.ts`
  - Moved prompts to config module: `/Users/vodnik/Desktop/FuckinHabits/src/config/agent-prompts.ts`
  - Added reusable date-time helper module: `/Users/vodnik/Desktop/FuckinHabits/src/lib/date-time.ts`

7. Frontend API consistency gap:
- Found: several settings mutations used raw `fetch`, bypassing shared auth/tz/mock transport contract.
- Done: switched to `apiFetch` in `/Users/vodnik/Desktop/FuckinHabits/src/components/app-shell.tsx`.

8. UI quality issue:
- Found: top nav rendered 4 buttons in a 3-column grid.
- Done: corrected to 4 columns in `/Users/vodnik/Desktop/FuckinHabits/src/components/app-shell.tsx`.

9. Telegram BackButton lifecycle mismatch:
- Found: `onClick`/`offClick` callbacks were different function instances.
- Done: fixed callback stability in `/Users/vodnik/Desktop/FuckinHabits/src/app/birthdays/page.tsx`.

10. Hardening changes:
- safer mock id parsing in `/Users/vodnik/Desktop/FuckinHabits/src/lib/api-auth.ts`
- stricter production credential behavior in `/Users/vodnik/Desktop/FuckinHabits/src/lib/google-calendar.ts`
- reduced noisy/sensitive init logging in `/Users/vodnik/Desktop/FuckinHabits/src/lib/supabase.ts`

### Validation
- `npm run lint` passed.
- `npm run build` passed.

### Deployment and logs
- Attempted prod deploy via `npx vercel --prod --yes`.
- Blocker: Vercel CLI auth is invalid/missing in this environment (`The specified token is not valid`), so deploy and post-deploy log check could not be completed in this run.

### External references reviewed for this run
- Google Calendar API events reference: https://developers.google.com/workspace/calendar/api/v3/reference/events
- Google Calendar API `events.list` reference: https://developers.google.com/workspace/calendar/api/v3/reference/events/list
- dbt data tests docs (data quality): https://docs.getdbt.com/docs/build/data-tests
- OpenTelemetry specification concepts: https://opentelemetry.io/docs/concepts/signals/
- O'Reilly book page for Designing Data-Intensive Applications: https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/

### 2026-02-13 23:55:12 MSK (+0300) Addendum
- Git commits pushed to `origin/main` successfully:
  - `4690d62` refactor: harden cron delivery and centralize runtime config
  - `e29db40` chore: keep workflow file unchanged for token-scope compatibility
- Note: workflow-file fix could not be retained in pushed state because the available GitHub credential rejects workflow updates without `workflow` scope.
## 2026-02-14 00:00:50 MSK (+0300)

### What I reviewed in this run
- Re-scanned all project files and re-focused on remaining quality gaps in security, data/report alignment, and date handling.
- Checked for Instantly integration references in repo: none found (`instantly` string search returned no matches).

### Additional refactors completed
1. Webhook security:
- Added optional Telegram webhook secret validation via `x-telegram-bot-api-secret-token`:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/webhook-auth.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/webhook/route.ts`
- Added env var in config template:
  - `/Users/vodnik/Desktop/FuckinHabits/.env.example`

2. Birthdays API hardening:
- Added strict `zod` validation for create/update inputs (`name`, `date`) and cleaner status handling:
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/birthdays/route.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/birthdays/[id]/route.ts`

3. Birthdays date consistency (timezone-safe):
- Replaced JS Date parsing of `YYYY-MM-DD` with deterministic month/day parser in UI to avoid offset drift:
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/birthdays/page.tsx`

4. Metrics alignment with actual DB events:
- `stats/summary`: `daysWithAnyCompletion` now counts real completion facts for the entire period, not just currently active habits.
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/stats/summary/route.ts`
- `stats/heatmap` (`metric=habits`): denominator now uses all user habits (not only active) to reduce historical report drift after deactivation.
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/stats/heatmap/route.ts`

### Validation
- `npm run lint` passed.
- `npm run build` passed.

### Deploy/log checks
- Deploy attempt: `npx vercel --prod --yes` -> failed due invalid token.
- Logs attempt: `npx vercel logs --since 1h` -> failed due missing credentials.
- Result: deploy/log verification is blocked in this environment until valid Vercel auth is available.

### External references checked this run (inspiration/validation)
- Telegram Bot API (webhook secret token header): https://core.telegram.org/bots/api#setwebhook
- OpenTelemetry docs (signal quality/observability): https://opentelemetry.io/docs/concepts/signals/
- dbt docs for data quality testing patterns: https://docs.getdbt.com/docs/build/data-tests
- Google Calendar API reference: https://developers.google.com/workspace/calendar/api/v3/reference/events/list

## 2026-02-14 00:05:51 MSK (+0300)

### What I found and improved this pass
1. Cron scalability risk (high query and send fan-out)
- Found: cron handlers processed large user sets with unbounded `Promise.allSettled` and, for missing reminders, per-day/per-user DB queries (N+1 pattern).
- Refactor done:
  - added batch executor `/Users/vodnik/Desktop/FuckinHabits/src/lib/async.ts`
  - added bounded processing in
    - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/hourly/route.ts`
    - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/remind/route.ts`
    - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/remind-missing/route.ts`
  - replaced N+1 in `remind-missing` by range fetch + in-memory date-set check.

2. Security hardening for auth bypass
- Found: `TELEGRAM_BYPASS_AUTH=true` could potentially be applied in production.
- Refactor done:
  - bypass now allowed in production only with explicit `TELEGRAM_BYPASS_AUTH_ALLOW_PROD=true`:
    - `/Users/vodnik/Desktop/FuckinHabits/src/lib/api-auth.ts`

3. Webhook secret check improvement
- Found: webhook secret was checked with plain equality.
- Refactor done:
  - moved to constant-time compare to avoid timing leakage:
    - `/Users/vodnik/Desktop/FuckinHabits/src/lib/webhook-auth.ts`

4. Code hygiene / maintainability
- Removed unnecessary `any` in bot/calendar code and removed noisy classification logging:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/bot.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/google-calendar.ts`

5. Config and docs consistency
- Added env-controlled knobs for cron processing and prod bypass policy:
  - `/Users/vodnik/Desktop/FuckinHabits/src/config/app.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/.env.example`
- Updated docs env snippet:
  - `/Users/vodnik/Desktop/FuckinHabits/README.md`

### Validation
- `npm run lint` passed.
- `npm run build` passed.

### Vercel deploy/log check
- `npx vercel --prod --yes` failed: invalid token.
- `npx vercel logs --since 1h` failed: no credentials.
- This environment still blocks deploy/log verification until valid Vercel auth is present.

### External references checked this pass
- Google SRE Book (reliability patterns): https://sre.google/sre-book/table-of-contents/
- OpenTelemetry concepts (observability quality): https://opentelemetry.io/docs/concepts/signals/
- dbt data tests (analytics/data quality controls): https://docs.getdbt.com/docs/build/data-tests

## 2026-02-14 00:10:03 MSK (+0300)

### Deep-dive findings and fixes (this run)
1. Consistency drift risk in reminder logic
- Found duplicated “has data for date” checks across modules, increasing chance of behavioral drift.
- Refactor:
  - Added unified helper in `/Users/vodnik/Desktop/FuckinHabits/src/lib/db/day-data.ts`
  - Reused in:
    - `/Users/vodnik/Desktop/FuckinHabits/src/lib/features/reminders.ts`
    - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/remind/route.ts`

2. Secret-comparison hardening for cron authorization
- Found direct string comparison for cron secret.
- Refactor:
  - Implemented constant-time compare + resilient Bearer parsing in `/Users/vodnik/Desktop/FuckinHabits/src/lib/cron-auth.ts`

3. Hardcoded numeric parameter in bot scheduling
- Found hardcoded default timed-event duration (`30` min).
- Refactor:
  - Moved to config `DEFAULT_EVENT_DURATION_MINUTES`:
    - `/Users/vodnik/Desktop/FuckinHabits/src/config/app.ts`
    - `/Users/vodnik/Desktop/FuckinHabits/src/lib/bot.ts`
    - `/Users/vodnik/Desktop/FuckinHabits/.env.example`
    - `/Users/vodnik/Desktop/FuckinHabits/README.md`

4. Additional code hygiene
- Removed extra `any` footprint/noisy classification logging in bot path.
- Removed explicit `any` cast in Google calendar client creation.

### Validation
- `npm run lint` passed.
- `npm run build` passed.

### Deploy/log checks
- `npx vercel --prod --yes` -> failed (invalid token).
- `npx vercel logs --since 1h` -> failed (missing credentials).
- Deploy and post-deploy logs are still blocked by auth state on this machine.

### Sources reviewed for this run (inspiration/standards)
- Google SRE book (availability/reliability design): https://sre.google/sre-book/table-of-contents/
- dbt data tests (metric/data quality controls): https://docs.getdbt.com/docs/build/data-tests
- OpenTelemetry signals (observability completeness): https://opentelemetry.io/docs/concepts/signals/
- NIST SP 800-63B (auth verifier guidance): https://pages.nist.gov/800-63-4/sp800-63b.html

## 2026-02-16 17:02:24 MSK (+0300)

### What was broken
- User messages requesting task list (e.g. “покажи задачи на сегодня”) often ended up as journal notes.
- Bot did not have a dedicated “show today tasks” command/button flow independent from LLM quality.
- Task-list messages could accumulate and duplicate.

### Refactor done (without changing core business goals)
1. Fixed task-list intent delivery reliability:
- Added deterministic quick intent matcher for task-list requests:
  - `/Users/vodnik/Desktop/FuckinHabits/src/config/bot.ts`
  - wired in `/Users/vodnik/Desktop/FuckinHabits/src/lib/bot.ts`
- Updated `get_events` behavior to fallback to “today” date if classifier omits date.

2. Added direct bot controls:
- New commands:
  - `/tasks`
  - `/today`
- New inline button in `/start` message:
  - “📋 Показать задачи на сегодня”

3. Implemented unified todo-list sender with dedupe:
- New shared sender module:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/features/task-lists.ts`
- Daily digest now uses same sender path:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/features/digest.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/hourly/route.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/app/api/cron/daily-digest/route.ts`
- Before sending new task-list message, all previous tracked task-list messages are deleted.

4. Added persistence for duplicate cleanup:
- DB migration/table:
  - `/Users/vodnik/Desktop/FuckinHabits/supabase/migrations/20260216000000_add_bot_messages.sql`
  - `/Users/vodnik/Desktop/FuckinHabits/supabase/schema.sql`
- DB helper methods:
  - `/Users/vodnik/Desktop/FuckinHabits/src/lib/db/bot-messages.ts`
- Safety: if migration not applied yet, bot now fails open (no 500 due missing table), and still sends task list.

5. Config/doc alignment:
- Added/used config keys and constants:
  - `/Users/vodnik/Desktop/FuckinHabits/src/config/app.ts`
  - `/Users/vodnik/Desktop/FuckinHabits/src/config/bot.ts`
- Updated env/docs:
  - `/Users/vodnik/Desktop/FuckinHabits/.env.example`
  - `/Users/vodnik/Desktop/FuckinHabits/README.md`

### Tests and verification
- `npm run lint` passed.
- `npm run build` passed.

### Deploy and logs
- Production deploy successful:
  - `https://fuckin-habits.vercel.app`
  - deployment URL: `https://fuckin-habits-p24a5p6wx-olegstroganov04-gmailcoms-projects.vercel.app`
- Runtime checks:
  - `GET /` => `200`
  - `GET /api/cron/hourly` without auth => `401` (expected)
- Logs check in current window:
  - no `500` runtime logs found.

### Note on Telegram native checklist type
- Official Telegram Bot API `sendChecklist` currently works when bot acts on behalf of a connected Business account.
- Implemented robust cross-bot todo-list UX via interactive inline task list (works in regular bot mode) with auto-complete handling and dedupe.

### External references consulted for this pass
- Telegram Bot API changelog (checklist methods context): https://core.telegram.org/bots/api-changelog
- Telegram Bot API sendChecklist docs: https://core.telegram.org/bots/api#sendchecklist
- Google Calendar API events.list reference: https://developers.google.com/workspace/calendar/api/v3/reference/events/list

## 2026-02-16 17:04:38 MSK (+0300)

### Final pass (this run)
1. `.gitignore` decision
- Checked newly generated ignore rules after Vercel linking.
- Kept `.env*.local` in `.gitignore` as valid hardening (prevents committing local env secrets beyond only `.env.local`).

2. Validation rerun
- `npm run lint` passed.
- `npm run build` passed.

3. Readiness
- Refactor package from this cycle is stable and ready for commit/push.

## 2026-02-16 17:09:35 MSK (+0300)

### Commit / push / deploy completion
1. Git
- Committed all refactor + docs changes:
  - commit: `bd03f32`
  - message: `refactor(bot): stabilize task-list flow and digest dedupe`
- Pushed to GitHub:
  - `main` advanced `732155d -> bd03f32`.

2. Vercel
- Production deploy triggered via CLI.
- Deployment verified as `READY`:
  - `https://fuckin-habits-glza78i6p-olegstroganov04-gmailcoms-projects.vercel.app`
- Deployment metadata confirms commit sha:
  - `bd03f32486c6b0ae6973207ac25a5ddcd077d473`

3. Runtime checks
- `GET https://fuckin-habits.vercel.app` => `200`.
- Production logs (recent window) checked:
  - no `500` status entries found.
