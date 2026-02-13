import { APP_CONFIG } from "@/config/app";
import { mapSettledInBatches } from "@/lib/async";
import { requireCronAuth } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendDailyDigest } from "@/lib/features/digest";
import { sendJournalReminder } from "@/lib/features/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDigestTime(raw: string | null | undefined): { hour: number; minute: number } {
  const fallback = APP_CONFIG.defaultDigestTime;
  const value = raw ?? fallback;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) {
    const fb = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(fallback);
    if (!fb) return { hour: 9, minute: 0 };
    return { hour: Number(fb[1]), minute: Number(fb[2]) };
  }
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

async function runHourly(request: Request) {
  try {
    const unauthorized = requireCronAuth(request);
    if (unauthorized) return unauthorized;

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch all users
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, telegram_id, tz_offset_minutes, digest_time")
      .limit(APP_CONFIG.cronUsersBatchLimit);

    if (error) throw error;

    const results = await mapSettledInBatches(
      users ?? [],
      APP_CONFIG.cronProcessBatchSize,
      async (user) => {
        const tzOffset = user.tz_offset_minutes ?? 0;
        const now = new Date();
        
        // Calculate User's Local Time
        const userLocalTime = new Date(now.getTime() + tzOffset * 60_000);
        const userHour = userLocalTime.getUTCHours();
        const userMinute = userLocalTime.getUTCMinutes();
        const { hour: digestHour, minute: digestMinute } = parseDigestTime(
          String((user as { digest_time?: string | null }).digest_time ?? ""),
        );
        const minuteDelta = Math.abs(userMinute - digestMinute);
        const minuteMatch = minuteDelta <= APP_CONFIG.cronMinuteTolerance;
        
        const actions = [];

        // Hourly cron cannot guarantee minute precision; we honor user hour reliably.
        if (userHour === digestHour) {
             const sent = await sendDailyDigest(user.telegram_id, tzOffset);
             if (minuteMatch) {
               actions.push(sent ? "digest_sent" : "digest_failed");
             } else {
               actions.push(sent ? "digest_sent_hour_fallback" : "digest_failed");
             }
        }

        // 2. 00:00 (Midnight) -> Send Journal Reminder for the ending day
        // We check if it is roughly midnight (e.g. 00:00 - 00:59)
        if (userHour === 0) {
             // The day that just ended is "yesterday" relative to this new 00:00 time
             const previousDay = new Date(userLocalTime);
             previousDay.setUTCDate(previousDay.getUTCDate() - 1);
             
             const y = previousDay.getUTCFullYear();
             const m = String(previousDay.getUTCMonth() + 1).padStart(2, "0");
             const d = String(previousDay.getUTCDate()).padStart(2, "0");
             const dateStr = `${y}-${m}-${d}`;

             const sent = await sendJournalReminder(user.id, user.telegram_id, dateStr);
             actions.push(sent ? "reminder_sent" : "reminder_skipped");
        }

        return { userId: user.id, actions };
      },
    );

    const summary = results.map((r) => (r.status === "fulfilled" ? r.value : r.reason));

    return Response.json({ ok: true, summary });
  } catch (e) {
    console.error("Hourly cron error:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return runHourly(request);
}

export async function GET(request: Request) {
  return runHourly(request);
}
