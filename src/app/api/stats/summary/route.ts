import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const DailyRow = z.object({
  date: z.string(),
  rating_efficiency: z.number().nullable(),
  rating_social: z.number().nullable(),
});

const CompletionRow = z.object({
  date: z.string(),
  habit_id: z.string(),
});

function decIsoDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function calcBestStreak(datesAsc: string[]): number {
  if (!datesAsc.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < datesAsc.length; i += 1) {
    const prev = datesAsc[i - 1];
    const expected = new Date(`${prev}T00:00:00Z`);
    expected.setUTCDate(expected.getUTCDate() + 1);
    const nextExpected = expected.toISOString().slice(0, 10);
    if (datesAsc[i] === nextExpected) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

export async function GET(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const url = new URL(request.url);
    const { fromDate, toDate } = QuerySchema.parse({
      fromDate: url.searchParams.get("fromDate") ?? undefined,
      toDate: url.searchParams.get("toDate") ?? undefined,
    });

    const supabaseAdmin = getSupabaseAdmin();

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const logicalToday = getLogicalDate(new Date(), tzOffsetMinutes);
    const year = Number(logicalToday.slice(0, 4));

    const from = fromDate ?? `${year}-01-01`;
    const to = toDate ?? logicalToday;
    const streakAnchorDate = to;

    const { data: daily, error: dailyErr } = await supabaseAdmin
      .from("daily_logs")
      .select("date,rating_efficiency,rating_social")
      .eq("user_id", user.id)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true });

    if (dailyErr) throw dailyErr;

    const dailyRows = z.array(DailyRow).parse(daily ?? []);

    const effVals = dailyRows.map((r) => r.rating_efficiency).filter((v): v is number => v !== null);
    const socVals = dailyRows.map((r) => r.rating_social).filter((v): v is number => v !== null);

    const avgEff = effVals.length ? effVals.reduce((a, b) => a + b, 0) / effVals.length : null;
    const avgSoc = socVals.length ? socVals.reduce((a, b) => a + b, 0) / socVals.length : null;

    const avgOverall =
      dailyRows.length
        ? (() => {
            const vals = dailyRows
              .map((r) => {
                const e = r.rating_efficiency;
                const s = r.rating_social;
                if (e === null && s === null) return null;
                if (e !== null && s !== null) return (e + s) / 2;
                return e ?? s;
              })
              .filter((v): v is number => v !== null);
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          })()
        : null;

    const { data: habits, error: habitsErr } = await supabaseAdmin
      .from("habits")
      .select("id,title")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (habitsErr) throw habitsErr;

    const habitList = (habits ?? []).map((h) => ({
      id: String((h as { id: unknown }).id),
      title: String((h as { title: unknown }).title),
    }));

    const habitIds = habitList.map((h) => h.id);

    let completionRows: Array<{ date: string; habit_id: string }> = [];
    if (habitIds.length) {
      const { data: hc, error: hcErr } = await supabaseAdmin
        .from("habit_completions")
        .select("date,habit_id")
        .eq("user_id", user.id)
        .in("habit_id", habitIds)
        .gte("date", from)
        .lte("date", to);

      if (hcErr) throw hcErr;
      completionRows = z.array(CompletionRow).parse(hc ?? []);
    }

    const byHabit = new Map<string, Set<string>>();
    for (const r of completionRows) {
      const set = byHabit.get(r.habit_id) ?? new Set<string>();
      set.add(r.date);
      byHabit.set(r.habit_id, set);
    }

    const streaks = habitList.map((h) => {
      const set = byHabit.get(h.id) ?? new Set<string>();
      const datesAsc = Array.from(set).sort();
      const best = calcBestStreak(datesAsc);

      let cur = 0;
      let cursor = streakAnchorDate;
      while (set.has(cursor)) {
        cur += 1;
        cursor = decIsoDate(cursor);
      }

      return {
        habitId: h.id,
        title: h.title,
        currentStreak: cur,
        bestStreak: best,
        totalCompletions: set.size,
      };
    });

    const daysWithAnyCompletion = new Set(completionRows.map((r) => r.date)).size;

    return Response.json({
      fromDate: from,
      toDate: to,
      avgEfficiency: avgEff,
      avgSocial: avgSoc,
      avgOverall,
      daysWithRatings: dailyRows.filter((r) => r.rating_efficiency !== null || r.rating_social !== null).length,
      daysWithAnyCompletion,
      streaks,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
