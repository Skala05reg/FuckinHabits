import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Row = z.object({
  date: z.string(),
  rating_efficiency: z.number().nullable(),
  rating_social: z.number().nullable(),
});

const CompletionRow = z.object({
  date: z.string(),
  habit_id: z.string(),
});

const QuerySchema = z.object({
  metric: z.enum(["avg", "efficiency", "social", "habits", "habit"]).optional(),
  habitId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const supabaseAdmin = getSupabaseAdmin();

    const url = new URL(request.url);
    const { metric, habitId } = QuerySchema.parse({
      metric: url.searchParams.get("metric") ?? undefined,
      habitId: url.searchParams.get("habitId") ?? undefined,
    });
    const selectedMetric = metric ?? "avg";

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const logicalToday = getLogicalDate(new Date(), tzOffsetMinutes);
    const year = Number(logicalToday.slice(0, 4));
    if (!Number.isFinite(year) || year < 1970 || year > 2500) {
      throw new Error("Invalid year");
    }

    const fromDate = `${year}-01-01`;
    const toDate = `${year}-12-31`;

    if (selectedMetric === "habit") {
      if (!habitId) throw new Error("Missing habitId");

      const { data: hc, error: hcError } = await supabaseAdmin
        .from("habit_completions")
        .select("date,habit_id")
        .eq("user_id", user.id)
        .eq("habit_id", habitId)
        .gte("date", fromDate)
        .lte("date", toDate);

      if (hcError) throw hcError;
      const rows = z.array(CompletionRow).parse(hc ?? []);

      const set = new Set(rows.map((r) => r.date));
      const points = Array.from(set)
        .sort()
        .map((d) => ({ date: d, value: 5 }));

      return Response.json({ year, fromDate, toDate, metric: selectedMetric, habitId, points });
    }

    if (selectedMetric === "habits") {
      const { data: habits, error: habitsError } = await supabaseAdmin
        .from("habits")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (habitsError) throw habitsError;
      const habitIds = (habits ?? []).map((h) => String((h as { id: unknown }).id));
      const total = habitIds.length;
      if (!total) {
        return Response.json({ year, fromDate, toDate, metric: selectedMetric, points: [] });
      }

      const { data: hc, error: hcError } = await supabaseAdmin
        .from("habit_completions")
        .select("date,habit_id")
        .eq("user_id", user.id)
        .in("habit_id", habitIds)
        .gte("date", fromDate)
        .lte("date", toDate);

      if (hcError) throw hcError;
      const rows = z.array(CompletionRow).parse(hc ?? []);

      const counts = new Map<string, number>();
      for (const r of rows) {
        counts.set(r.date, (counts.get(r.date) ?? 0) + 1);
      }

      const points = Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => {
          const ratio = Math.min(1, Math.max(0, count / total));
          const value = Math.max(1, Math.round(ratio * 5));
          return { date, value };
        });

      return Response.json({ year, fromDate, toDate, metric: selectedMetric, points });
    }

    const { data, error } = await supabaseAdmin
      .from("daily_logs")
      .select("date,rating_efficiency,rating_social")
      .eq("user_id", user.id)
      .gte("date", fromDate)
      .lte("date", toDate)
      .order("date", { ascending: true });

    if (error) throw error;

    const rows = z.array(Row).parse(data ?? []);

    const points = rows.map((r) => {
      const e = r.rating_efficiency;
      const s = r.rating_social;

      if (selectedMetric === "efficiency") return { date: r.date, value: e ?? 0 };
      if (selectedMetric === "social") return { date: r.date, value: s ?? 0 };

      const value = e !== null && s !== null ? Math.round((e + s) / 2) : (e ?? s ?? 0);
      return { date: r.date, value };
    });

    return Response.json({ year, fromDate, toDate, metric: selectedMetric, points });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
