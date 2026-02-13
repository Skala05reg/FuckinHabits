export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader === `Bearer ${secret}`) {
    return true;
  }

  const legacyHeader = request.headers.get("x-cron-secret");
  return legacyHeader === secret;
}

export function requireCronAuth(request: Request): Response | null {
  if (isCronAuthorized(request)) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
