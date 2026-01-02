export type Habit = {
  id: string;
  title: string;
  is_active: boolean;
  position: number;
};

export type DayLog = {
  rating_efficiency: number | null;
  rating_social: number | null;
  journal_text: string | null;
};

export type UserStatus = {
  date: string;
  habits: Habit[];
  completedHabitIds: string[];
  dayLog: DayLog | null;
};

export type HeatmapPoint = {
  date: string;
  value: number;
};

export type HeatmapResponse = {
  fromDate: string;
  points: HeatmapPoint[];
};

export async function apiFetch<T>(
  input: string,
  initData: string,
  opts?: {
    tzOffsetMinutes?: number;
    mockTelegramId?: string | null;
    method?: "GET" | "POST";
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
