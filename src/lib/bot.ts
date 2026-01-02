import { Bot, InlineKeyboard } from "grammy";

import { ensureUser } from "@/lib/db/users";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

type GlobalWithBot = typeof globalThis & { __bot?: Bot };

export function getBot(): Bot {
  const g = globalThis as GlobalWithBot;
  if (g.__bot) return g.__bot;

  const bot = new Bot(requireEnv("TELEGRAM_BOT_TOKEN"));

  bot.command("start", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    await ensureUser({ telegramId, firstName: ctx.from?.first_name });

    const appUrl = process.env.WEBAPP_URL;
    const keyboard = new InlineKeyboard();
    if (appUrl) keyboard.webApp("Открыть трекер", appUrl);

    await ctx.reply(
      "Открой Mini App и отмечай привычки/оценки дня. Логический день длится до 04:00.",
      keyboard.inline_keyboard.length ? { reply_markup: keyboard } : undefined,
    );
  });

  bot.on("message:text", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await ensureUser({ telegramId, firstName: ctx.from?.first_name });
    const tzOffsetMinutes = user.tz_offset_minutes ?? 0;
    const date = getLogicalDate(new Date(), tzOffsetMinutes);

    const supabaseAdmin = getSupabaseAdmin();

    const text = ctx.message.text.trim();
    if (!text) return;

    const { error } = await supabaseAdmin
      .from("daily_logs")
      .upsert(
        {
          user_id: user.id,
          date,
          journal_text: text,
        },
        { onConflict: "user_id,date" },
      );

    if (error) throw error;

    await ctx.reply("Записал в дневник за этот логический день.");
  });

  bot.catch((err) => {
    console.error("Bot error", err.error);
  });

  g.__bot = bot;
  return bot;
}
