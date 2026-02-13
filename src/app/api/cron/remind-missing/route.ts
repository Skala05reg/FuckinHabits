import { APP_CONFIG } from "@/config/app";
import { InlineKeyboard } from "grammy";

import { mapSettledInBatches } from "@/lib/async";
import { getBot } from "@/lib/bot";
import { requireCronAuth } from "@/lib/cron-auth";
import { shiftIsoDate } from "@/lib/date-time";
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

    const results = await mapSettledInBatches(
      users ?? [],
      APP_CONFIG.cronProcessBatchSize,
      async (user) => {
        const tzOffsetMinutes = user.tz_offset_minutes ?? 0;
        const today = getLogicalDate(new Date(), tzOffsetMinutes);

        const lookbackDays = APP_CONFIG.remindMissingLookbackDays;
        const oldestDate = shiftIsoDate(today, -lookbackDays);
        const latestDate = shiftIsoDate(today, -1);

        const [{ data: dayLogs, error: dayLogsError }, { data: completions, error: completionsError }] =
          await Promise.all([
            supabaseAdmin
              .from("daily_logs")
              .select("date")
              .eq("user_id", user.id)
              .gte("date", oldestDate)
              .lte("date", latestDate),
            supabaseAdmin
              .from("habit_completions")
              .select("date")
              .eq("user_id", user.id)
              .gte("date", oldestDate)
              .lte("date", latestDate),
          ]);
        if (dayLogsError) throw dayLogsError;
        if (completionsError) throw completionsError;

        const dayLogDates = new Set((dayLogs ?? []).map((row) => String(row.date)));
        const completionDates = new Set((completions ?? []).map((row) => String(row.date)));

        const missingDays: string[] = [];
        for (let i = 1; i <= lookbackDays; i++) {
          const date = shiftIsoDate(today, -i);
          if (!dayLogDates.has(date) && !completionDates.has(date)) {
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
      },
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
