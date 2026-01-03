import crypto from "crypto";

export type TelegramInitDataUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export function validateInitDataOrThrow(initData: string, botToken: string): void {
  const data = parseInitData(initData);
  const receivedHash = data.hash;
  if (!receivedHash) throw new Error("Missing initData hash");

  delete data.hash;

  const dataCheckString = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(receivedHash, "hex");
  const b = Buffer.from(calculatedHash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid initData hash");
  }
}

export function getUserFromInitData(initData: string): TelegramInitDataUser {
  const data = parseInitData(initData);
  if (!data.user) throw new Error("Missing initData user");
  const user = JSON.parse(data.user) as TelegramInitDataUser;
  if (!user?.id) throw new Error("Invalid initData user payload");
  return user;
}
