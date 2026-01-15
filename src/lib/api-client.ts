export type Habit = {
  id: string;
  title: string;
  is_active: boolean;
  position: number;
};

export type Birthday = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
};

export type DayLog = {
  rating_efficiency: number | null;
  rating_social: number | null;
  journal_text: string | null;
};

export type YearGoal = {
  id: string;
  title: string;
  position: number;
};

export type UserStatus = {
  firstName: string | null;
  date: string;
  yearGoals: YearGoal[];
  habits: Habit[];
  completedHabitIds: string[];
  dayLog: DayLog | null;
};

export type HeatmapPoint = {
  date: string;
  value: number;
};

export type HeatmapResponse = {
  year: number;
  fromDate: string;
  toDate: string;
  metric: "avg" | "efficiency" | "social" | "habits" | "habit";
  habitId?: string;
  points: HeatmapPoint[];
};

export type NotesHistoryItem = {
  date: string;
  journalText: string;
  ratingEfficiency: number | null;
  ratingSocial: number | null;
};

export type NotesHistoryResponse = {
  items: NotesHistoryItem[];
  nextCursor: string | null;
};

export type StatsStreak = {
  habitId: string;
  title: string;
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
};

export type StatsSummaryResponse = {
  fromDate: string;
  toDate: string;
  avgEfficiency: number | null;
  avgSocial: number | null;
  avgOverall: number | null;
  daysWithRatings: number;
  daysWithAnyCompletion: number;
  streaks: StatsStreak[];
};

export async function apiFetch<T>(
  input: string,
  initData: string,
  opts?: {
    tzOffsetMinutes?: number;
    mockTelegramId?: string | null;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  },
): Promise<T> {
  const tzOffsetMinutes = opts?.tzOffsetMinutes ?? 0;
  const url = new URL(input, window.location.origin);
  url.searchParams.set("tzOffsetMinutes", String(tzOffsetMinutes));
  if (opts?.mockTelegramId) url.searchParams.set("mockTelegramId", opts.mockTelegramId);

  const res = await fetch(url.toString(), {
    method: opts?.method ?? (opts?.body ? "POST" : "GET"),
    headers: {
      "content-type": "application/json",
      "x-telegram-init-data": initData,
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });

  const json = (await res.json()) as unknown;
  if (!res.ok) {
    const msg =
      typeof json === "object" && json && "error" in json
        ? String((json as { error: unknown }).error)
        : "Request failed";
    throw new Error(msg);
  }
  return json as T;
}
