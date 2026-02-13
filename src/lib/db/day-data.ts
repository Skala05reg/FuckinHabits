import type { SupabaseClient } from "@supabase/supabase-js";

type DayDataPresence = {
  hasDayLog: boolean;
  hasCompletions: boolean;
};

export async function getDayDataPresence(
  supabase: SupabaseClient,
  params: { userId: string; date: string },
): Promise<DayDataPresence> {
  const { userId, date } = params;

  const [{ data: dayLog, error: dayLogError }, { data: completions, error: completionsError }] =
    await Promise.all([
      supabase
        .from("daily_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle(),
      supabase
        .from("habit_completions")
        .select("id")
        .eq("user_id", userId)
        .eq("date", date)
        .limit(1),
    ]);

  if (dayLogError) throw dayLogError;
  if (completionsError) throw completionsError;

  return {
    hasDayLog: !!dayLog,
    hasCompletions: !!completions && completions.length > 0,
  };
}

export async function hasAnyDayData(
  supabase: SupabaseClient,
  params: { userId: string; date: string },
): Promise<boolean> {
  const presence = await getDayDataPresence(supabase, params);
  return presence.hasDayLog || presence.hasCompletions;
}
