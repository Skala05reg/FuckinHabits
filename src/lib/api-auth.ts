import { getUserFromInitData, validateInitDataOrThrow } from "@/lib/telegram/init-data";

export type AuthedTelegramUser = {
  telegramId: number;
  firstName?: string;
};

export async function getTelegramAuthOrThrow(
  request: Request,
): Promise<AuthedTelegramUser> {
  const url = new URL(request.url);

  const bypass = process.env.TELEGRAM_BYPASS_AUTH === "true";
  const mockTelegramId = url.searchParams.get("mockTelegramId");
  if (bypass && mockTelegramId) {
    return { telegramId: Number(mockTelegramId) };
  }

  const initData = request.headers.get("x-telegram-init-data") ?? "";
  if (!initData) {
    if (bypass && request.headers.get("x-mock-telegram-id")) {
      return { telegramId: Number(request.headers.get("x-mock-telegram-id")) };
    }
    throw new Error("Missing x-telegram-init-data header");
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN");

  validateInitDataOrThrow(initData, botToken);
  const user = getUserFromInitData(initData);

  return { telegramId: user.id, firstName: user.first_name };
}

export function getTzOffsetMinutes(request: Request): number {
  const url = new URL(request.url);
  const raw = url.searchParams.get("tzOffsetMinutes") ?? request.headers.get("x-tz-offset-minutes");
  const n = raw ? Number(raw) : 0;
  if (!Number.isFinite(n) || Math.abs(n) > 14 * 60) return 0;
  return n;
}
