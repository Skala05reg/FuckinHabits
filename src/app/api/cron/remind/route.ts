import { APP_CONFIG } from "@/config/app";
import { InlineKeyboard } from "grammy";

import { getBot } from "@/lib/bot";
import { requireCronAuth } from "@/lib/cron-auth";
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

    const results = await Promise.allSettled(
      (users ?? []).map(async (user) => {
        const tzOffsetMinutes = user.tz_offset_minutes ?? 0;
        const today = getLogicalDate(new Date(), tzOffsetMinutes);

        // Check yesterday for missing data
        const yesterday = new Date(`${today}T00:00:00Z`);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayDate = yesterday.toISOString().slice(0, 10);

        // Check if daily_log exists for yesterday
        const { data: dayLog } = await supabaseAdmin
          .from("daily_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", yesterdayDate)
          .maybeSingle();

        // Check if any habits were completed yesterday
        const { data: completions } = await supabaseAdmin
          .from("habit_completions")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", yesterdayDate)
          .limit(1);

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
      }),
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
