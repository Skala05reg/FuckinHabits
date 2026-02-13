import { APP_CONFIG } from "@/config/app";
import { getBot } from "@/lib/bot";
import { requireCronAuth } from "@/lib/cron-auth";
import { extractMonthDayFromIsoDate, getMonthDayInTimeZone } from "@/lib/date-time";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BirthdayRow = {
  name: string;
  date: string;
  user_id: string;
  users?: { telegram_id?: number } | null;
};

async function runCheckBirthdays(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdmin();
  const bot = getBot();
  await bot.init();

  const timeZone = APP_CONFIG.defaultCalendarTimeZone;
  const { month: targetMonth, day: targetDay } = getMonthDayInTimeZone(new Date(), timeZone);

  const { data: birthdays, error } = await supabase
    .from("birthdays")
    .select("name,date,user_id,users!inner(telegram_id)");

  if (error) {
    console.error("Error fetching birthdays", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (birthdays ?? []) as BirthdayRow[];
  const matches = rows.filter((b) => {
    try {
      const { month, day } = extractMonthDayFromIsoDate(b.date);
      return month === targetMonth && day === targetDay;
    } catch {
      return false;
    }
  });

  const todayInTz = `${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
  console.log(`Checking birthdays for timezone ${timeZone} (${todayInTz}). Found ${matches.length} matches.`);

  const results: Array<{ sent: boolean; name: string; user?: string; error?: string }> = [];

  for (const b of matches) {
    const telegramId = b.users?.telegram_id;
    if (!telegramId) continue;

    try {
      await bot.api.sendMessage(
        telegramId,
        `Йоу! У ${b.name} сегодня День Рождения! Поздравь его! 🎉`,
      );
      results.push({ sent: true, name: b.name, user: b.user_id });
    } catch (err) {
      console.error(`Failed to send to ${telegramId}`, err);
      results.push({ sent: false, name: b.name, error: String(err) });
    }
  }

  return NextResponse.json({
    processed: matches.length,
    sent: results.filter((r) => r.sent).length,
    details: results,
  });
}

export async function POST(request: Request) {
  return runCheckBirthdays(request);
}

export async function GET(request: Request) {
  return runCheckBirthdays(request);
}
