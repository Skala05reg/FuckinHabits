import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HabitRow = z.object({
  id: z.string(),
  title: z.string(),
  is_active: z.boolean(),
  position: z.number(),
});

const GoalRow = z.object({
  id: z.string(),
  title: z.string(),
  is_active: z.boolean(),
  position: z.number(),
  year: z.number(),
});

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const url = new URL(request.url);
    const { date: queryDate } = QuerySchema.parse({
      date: url.searchParams.get("date") ?? undefined,
    });
    const supabaseAdmin = getSupabaseAdmin();

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const date = queryDate ?? getLogicalDate(new Date(), tzOffsetMinutes);
    const year = Number(date.slice(0, 4));
    if (!Number.isFinite(year) || year < 1970 || year > 2500) {
      throw new Error("Invalid year");
    }

    const { data: habits, error: habitsError } = await supabaseAdmin
      .from("habits")
      .select("id,title,is_active,position")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (habitsError) throw habitsError;

    const parsedHabits = z.array(HabitRow).parse(habits ?? []);

    const { data: completions, error: completionsError } = await supabaseAdmin
      .from("habit_completions")
      .select("habit_id")
      .eq("user_id", user.id)
      .eq("date", date);

    if (completionsError) throw completionsError;

    const completedHabitIds = (completions ?? []).map((c) => c.habit_id as string);

    const { data: dayLog, error: dayLogError } = await supabaseAdmin
      .from("daily_logs")
      .select("rating_efficiency,rating_social,journal_text")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();

    if (dayLogError) throw dayLogError;

    const { data: goals, error: goalsError } = await supabaseAdmin
      .from("year_goals")
      .select("id,title,is_active,position,year")
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (goalsError) throw goalsError;

    const parsedGoals = z.array(GoalRow).parse(goals ?? []);

    return Response.json({
      firstName: user.first_name ?? null,
      date,
      yearGoals: parsedGoals.map((g) => ({ id: g.id, title: g.title, position: g.position })),
      habits: parsedHabits,
      completedHabitIds,
      dayLog: dayLog ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
