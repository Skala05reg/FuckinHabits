export function formatOffsetMinutes(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function getDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Failed to format date in timezone: ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

export function getMonthDayInTimeZone(date: Date, timeZone: string): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const monthStr = parts.find((p) => p.type === "month")?.value;
  const dayStr = parts.find((p) => p.type === "day")?.value;
  const month = monthStr ? Number(monthStr) : NaN;
  const day = dayStr ? Number(dayStr) : NaN;

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Failed to extract month/day in timezone: ${timeZone}`);
  }

  return { month, day };
}

export function extractMonthDayFromIsoDate(isoDate: string): { month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`Invalid ISO date: ${isoDate}`);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Invalid month/day in ISO date: ${isoDate}`);
  }
  return { month, day };
}
