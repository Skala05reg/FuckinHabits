import crypto from "crypto";

function equalsConstantTime(a: string, b: string): boolean {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  return match[1]?.trim() ?? null;
}

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const bearer = parseBearer(request.headers.get("authorization"));
  if (bearer && equalsConstantTime(bearer, secret)) {
    return true;
  }

  const legacyHeader = request.headers.get("x-cron-secret");
  return !!legacyHeader && equalsConstantTime(legacyHeader, secret);
}

export function requireCronAuth(request: Request): Response | null {
  if (isCronAuthorized(request)) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
