import { getBot } from "@/lib/bot";
import { validateTelegramWebhookSecret } from "@/lib/webhook-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    validateTelegramWebhookSecret(request);
    const update = await request.json();
    const bot = getBot();
    await bot.init();
    await bot.handleUpdate(update);
    return new Response("ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "Invalid Telegram webhook secret" ? 401 : 400;
    return Response.json({ error: msg }, { status });
  }
}
