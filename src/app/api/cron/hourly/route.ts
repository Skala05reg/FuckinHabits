import { getSupabaseAdmin } from "@/lib/supabase";
import { sendDailyDigest } from "@/lib/features/digest";
import { sendJournalReminder } from "@/lib/features/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch all users
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, telegram_id, tz_offset_minutes");

    if (error) throw error;

    const results = await Promise.allSettled(
      (users ?? []).map(async (user) => {
        const tzOffset = user.tz_offset_minutes ?? 0;
        const now = new Date();
        
        // Calculate User's Local Time
        const userLocalTime = new Date(now.getTime() + tzOffset * 60000);
        const userHour = userLocalTime.getUTCHours();
        
        const actions = [];

        // 1. 9:00 AM -> Send Daily Digest
        if (userHour === 9) {
             const sent = await sendDailyDigest(user.telegram_id, tzOffset);
             actions.push(sent ? "digest_sent" : "digest_failed");
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
      })
    );

    const summary = results.map(r => r.status === 'fulfilled' ? r.value : r.reason);

    return Response.json({ ok: true, summary });
  } catch (e) {
    console.error("Hourly cron error:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
