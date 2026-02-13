import { APP_CONFIG } from "@/config/app";
import { InlineKeyboard } from "grammy";

import { getBot } from "@/lib/bot";
import { requireCronAuth } from "@/lib/cron-auth";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function runRemindMissing(request: Request) {
  try {
    const unauthorized = requireCronAuth(request);
    if (unauthorized) return unauthorized;

    const supabaseAdmin = getSupabaseAdmin();

    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, telegram_id, tz_offset_minutes")
      .limit(APP_CONFIG.cronUsersBatchLimit);

    if (usersError) throw usersError;

    const bot = getBot();
    await bot.init();
    const appUrl = process.env.WEBAPP_URL;

    const results = await Promise.allSettled(
      (users ?? []).map(async (user) => {
        const tzOffsetMinutes = user.tz_offset_minutes ?? 0;
        const today = getLogicalDate(new Date(), tzOffsetMinutes);

        // Check last 7 days for missing data
        const missingDays: string[] = [];
        for (let i = 1; i <= 7; i++) {
          const d = new Date(`${today}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() - i);
          const date = d.toISOString().slice(0, 10);

          // Check if daily_log exists for this date
          const { data: dayLog } = await supabaseAdmin
            .from("daily_logs")
            .select("id")
            .eq("user_id", user.id)
            .eq("date", date)
            .maybeSingle();

          // Check if any habits were completed
          const { data: completions } = await supabaseAdmin
            .from("habit_completions")
            .select("id")
            .eq("user_id", user.id)
            .eq("date", date)
            .limit(1);

          // If no daily_log and no habit completions, consider it missing
          if (!dayLog && (!completions || completions.length === 0)) {
            missingDays.push(date);
          }
        }

        // Only send reminder if there are missing days
        if (missingDays.length === 0) {
          return { sent: false };
        }

        const keyboard = new InlineKeyboard();
        if (appUrl) keyboard.webApp("Заполнить пропущенные дни", appUrl);

        const daysList = missingDays.map((d) => `• ${d}`).join("\n");
        const message = `Бро, ты забыл заполнить данные за эти даты:\n\n${daysList}\n\nЗаполни их, чтобы не терять прогресс! 📊`;

        await bot.api.sendMessage(
          Number(user.telegram_id),
          message,
          keyboard.inline_keyboard.length ? { reply_markup: keyboard } : undefined,
        );

        return { sent: true, missingDays: missingDays.length };
      }),
    );

    const ok = results.filter((r) => r.status === "fulfilled" && r.value.sent).length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return Response.json({ ok: true, sent: ok, failed, total: results.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function POST(request: Request) {
  return runRemindMissing(request);
}

export async function GET(request: Request) {
  return runRemindMissing(request);
}
