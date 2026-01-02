export function formatYYYYMMDDFromUTCParts(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getLogicalDate(nowUtc: Date, tzOffsetMinutes: number): string {
  const localMs = nowUtc.getTime() + tzOffsetMinutes * 60_000;
  const logicalMs = localMs - 4 * 60 * 60_000;
  const logical = new Date(logicalMs);
  return formatYYYYMMDDFromUTCParts(logical);
}
