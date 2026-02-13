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

async function runReminder(request: Request) {
  try {
    const unauthorized = requireCronAuth(request);
    if (unauthorized) return unauthorized;

    const supabaseAdmin = getSupabaseAdmin();

    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, telegram_id, tz_offset_minutes")
      .limit(APP_CONFIG.cronUsersBatchLimit);

    if (error) throw error;

    const bot = getBot();
    await bot.init();
    const appUrl = process.env.WEBAPP_URL;

    const results = await mapSettledInBatches(
      users ?? [],
      APP_CONFIG.cronProcessBatchSize,
      async (user) => {
        const tzOffsetMinutes = user.tz_offset_minutes ?? 0;
        const today = getLogicalDate(new Date(), tzOffsetMinutes);

        const yesterdayDate = shiftIsoDate(today, -1);

        const [{ data: dayLog, error: dayLogError }, { data: completions, error: completionsError }] =
          await Promise.all([
            supabaseAdmin
              .from("daily_logs")
              .select("id")
              .eq("user_id", user.id)
              .eq("date", yesterdayDate)
              .maybeSingle(),
            supabaseAdmin
              .from("habit_completions")
              .select("id")
              .eq("user_id", user.id)
              .eq("date", yesterdayDate)
              .limit(1),
          ]);
        if (dayLogError) throw dayLogError;
        if (completionsError) throw completionsError;

        const hasData = dayLog || (completions && completions.length > 0);

        const keyboard = new InlineKeyboard();
        if (appUrl) keyboard.webApp("Заполнить день", appUrl);

        const message = hasData
          ? "День почти закончился. Запиши итоги и отметь привычки."
          : `Бро, ты забыл заполнить данные за вчера (${yesterdayDate})! 📊\n\nЗаполни пропущенные дни, чтобы не терять прогресс.`;

        await bot.api.sendMessage(
          Number(user.telegram_id),
          message,
          keyboard.inline_keyboard.length ? { reply_markup: keyboard } : undefined,
        );

        return { sent: true, hadData: hasData };
      },
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    const missingData = results.filter(
      (r) => r.status === "fulfilled" && !r.value.hadData
    ).length;

    return Response.json({ ok: true, sent: ok, failed, missingData });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function POST(request: Request) {
  return runReminder(request);
}

export async function GET(request: Request) {
  return runReminder(request);
}
