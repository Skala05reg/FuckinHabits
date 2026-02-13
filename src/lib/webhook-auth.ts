const TELEGRAM_WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";

export function validateTelegramWebhookSecret(request: Request): void {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return;

  const received = request.headers.get(TELEGRAM_WEBHOOK_SECRET_HEADER);
  if (!received || received !== expected) {
    throw new Error("Invalid Telegram webhook secret");
  }
}
