import { APP_CONFIG } from "@/config/app";
import { getUserFromInitData, validateInitDataOrThrow } from "@/lib/telegram/init-data";

export type AuthedTelegramUser = {
  telegramId: number;
  firstName?: string;
};

function parseTelegramId(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

export async function getTelegramAuthOrThrow(
  request: Request,
): Promise<AuthedTelegramUser> {
  const url = new URL(request.url);

  const bypass = process.env.TELEGRAM_BYPASS_AUTH === "true";
  const mockTelegramId = parseTelegramId(url.searchParams.get("mockTelegramId"));
  if (bypass && mockTelegramId !== null) {
    return { telegramId: mockTelegramId };
  }

  const initData = request.headers.get("x-telegram-init-data") ?? "";
  if (!initData) {
    const headerMockId = parseTelegramId(request.headers.get("x-mock-telegram-id"));
    if (bypass && headerMockId !== null) {
      return { telegramId: headerMockId };
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
  if (!Number.isFinite(n) || Math.abs(n) > APP_CONFIG.tzOffsetLimitMinutes) return 0;
  return n;
}
