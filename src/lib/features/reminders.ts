import { getBot } from "@/lib/bot";
import { hasAnyDayData } from "@/lib/db/day-data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { InlineKeyboard } from "grammy";

export async function sendJournalReminder(userId: string, telegramId: number, dateStr: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const hasData = await hasAnyDayData(supabaseAdmin, { userId, date: dateStr });

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
