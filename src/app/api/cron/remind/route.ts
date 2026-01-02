import { InlineKeyboard } from "grammy";

import { getBot } from "@/lib/bot";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-cron-secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("telegram_id")
      .limit(5000);

    if (error) throw error;

    const bot = getBot();
    const appUrl = process.env.WEBAPP_URL;
    const keyboard = new InlineKeyboard();
    if (appUrl) keyboard.webApp("Заполнить день", appUrl);

    const results = await Promise.allSettled(
      (users ?? []).map((u) =>
        bot.api.sendMessage(
          Number(u.telegram_id),
          "День почти закончился. Запиши итоги и отметь привычки.",
          keyboard.inline_keyboard.length ? { reply_markup: keyboard } : undefined,
        ),
      ),
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;

    return Response.json({ ok: true, sent: ok, failed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
