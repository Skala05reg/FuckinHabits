import { getBot } from "@/lib/bot";
import { getSupabaseAdmin } from "@/lib/supabase";
import { InlineKeyboard } from "grammy";

export async function sendJournalReminder(userId: string, telegramId: number, dateStr: string) {
  const supabaseAdmin = getSupabaseAdmin();

  // Check if daily_log exists for this date
  const { data: dayLog } = await supabaseAdmin
    .from("daily_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .maybeSingle();

  // Check if any habits were completed
  const { data: completions } = await supabaseAdmin
    .from("habit_completions")
    .select("id")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .limit(1);

  const hasData = dayLog || (completions && completions.length > 0);

  if (hasData) return false;

  const bot = getBot();
  await bot.init();
  const appUrl = process.env.WEBAPP_URL;

  const keyboard = new InlineKeyboard();
  if (appUrl) keyboard.webApp("Заполнить день", appUrl);

  const message = `День подошел к концу (${dateStr}). 🌙
Не забудь записать итоги и отметить привычки!`;

  try {
    await bot.api.sendMessage(telegramId, message, keyboard.inline_keyboard.length ? { reply_markup: keyboard } : undefined);
    return true;
  } catch (e) {
    console.error(`Failed to send reminder to ${telegramId}`, e);
    return false;
  }
}
