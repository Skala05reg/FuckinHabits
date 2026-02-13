import crypto from "crypto";

const TELEGRAM_WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";

function equalsConstantTime(a: string, b: string): boolean {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function validateTelegramWebhookSecret(request: Request): void {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return;

  const received = request.headers.get(TELEGRAM_WEBHOOK_SECRET_HEADER);
  if (!received || !equalsConstantTime(received, expected)) {
    throw new Error("Invalid Telegram webhook secret");
  }
}
