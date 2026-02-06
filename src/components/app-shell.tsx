"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Plus, RefreshCw } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  apiFetch,
  type Habit,
  type HeatmapResponse,
  type NotesHistoryItem,
  type NotesHistoryResponse,
  type StatsSummaryResponse,
  type UserStatus,
} from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { getTelegramWebApp } from "@/lib/telegram/webapp";
import { useCallback, useEffect, useMemo, useState } from "react";

function getTzOffsetMinutesClient(): number {
  return -new Date().getTimezoneOffset();
}

function Heatmap({
  year,
  points,
}: {
  year: number;
  points: { date: string; value: number }[];
}) {
  const map = new Map(points.map((p) => [p.date, p.value]));
  const startIso = `${year}-01-01`;
  const endIso = `${year}-12-31`;

  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);

  const daysInYear: { date: string; value: number }[] = [];
  for (let d = new Date(start); d <= end;) {
    const iso = d.toISOString().slice(0, 10);
    daysInYear.push({ date: iso, value: map.get(iso) ?? 0 });
    d = new Date(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const mondayIndex = (start.getUTCDay() + 6) % 7;
  const padStart = Array.from({ length: mondayIndex }).map((_, i) => ({
    key: `pad-s-${i}`,
    value: 0,
  }));

  const padEndCount = (7 - ((padStart.length + daysInYear.length) % 7)) % 7;
  const padEnd = Array.from({ length: padEndCount }).map((_, i) => ({
    key: `pad-e-${i}`,
    value: 0,
  }));

  const color = (v: number) => {
    if (v <= 0) return "bg-muted/60";
    if (v === 1) return "bg-emerald-900/40";
    if (v === 2) return "bg-emerald-800/55";
    if (v === 3) return "bg-emerald-700/70";
    if (v === 4) return "bg-emerald-600/80";
    return "bg-emerald-500";
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
        {padStart.map((p) => (
          <div key={p.key} className={cn("h-3 w-3 rounded-sm", color(p.value))} />
        ))}
        {daysInYear.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.value}`}
            className={cn("h-3 w-3 rounded-sm", color(d.value))}
          />
        ))}
        {padEnd.map((p) => (
          <div key={p.key} className={cn("h-3 w-3 rounded-sm", color(p.value))} />
        ))}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Подсказка: можно скроллить по горизонтали.
      </div>
    </div>
  );
}

function getMockTelegramIdFromUrl(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get("mockTelegramId");
}

function useTelegramInitData(): { initData: string; isTelegram: boolean } {
  const [initData, setInitData] = useState<string>("");
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("tgWebAppData") ?? "";
    const fromHash = new URLSearchParams(url.hash.replace(/^#/, "")).get("tgWebAppData") ?? "";

    let attempt = 0;
    const maxAttempts = 30;

    const tick = () => {
      attempt += 1;
      const webApp = getTelegramWebApp();
      if (webApp) {
        setIsTelegram(true);
        webApp.ready();
        webApp.expand();
        webApp.setHeaderColor?.("#0b1220");
        webApp.setBackgroundColor?.("#0b1220");
        setInitData(webApp.initData || fromQuery || fromHash || "");
        return;
      }

      if (fromQuery || fromHash) {
        setIsTelegram(true);
        setInitData(fromQuery || fromHash);
        return;
      }

      if (attempt < maxAttempts) {
        setTimeout(tick, 100);
        return;
      }

      setIsTelegram(false);
      setInitData("");
    };

    tick();
  }, []);

  return { initData, isTelegram };
}

function msUntilNext4amLocal(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(4, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return Math.max(1_000, next.getTime() - now.getTime());
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AppShell() {
  const { initData, isTelegram } = useTelegramInitData();
  const tzOffsetMinutes = useMemo(() => getTzOffsetMinutesClient(), []);
  const [mockTelegramId, setMockTelegramId] = useState<string | null>(null);

  useEffect(() => {
    setMockTelegramId(getMockTelegramIdFromUrl());
  }, []);

  const canLoad = initData.length > 0 || !!mockTelegramId;

  const [screen, setScreen] = useState<"home" | "stats" | "settings">("home");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<UserStatus>(
    canLoad ? ["/api/user/status", tzOffsetMinutes, initData, mockTelegramId, selectedDate] : null,
    async () => {
      const qs = new URLSearchParams();
      if (selectedDate) qs.set("date", selectedDate);
      const path = `/api/user/status${qs.toString() ? `?${qs.toString()}` : ""}`;
      return apiFetch<UserStatus>(path, initData, {
        tzOffsetMinutes,
        mockTelegramId,
      });
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  const currentYear = useMemo(() => {
    const d = data?.date;
    if (!d) return new Date().getFullYear();
    const y = Number(d.slice(0, 4));
    return Number.isFinite(y) ? y : new Date().getFullYear();
  }, [data?.date]);

  const [heatmapMetric, setHeatmapMetric] = useState<
    "avg" | "efficiency" | "social" | "habits" | "habit"
  >("avg");
  const [heatmapHabitId, setHeatmapHabitId] = useState<string>("");

  const { data: heatmap, mutate: mutateHeatmap } = useSWR<HeatmapResponse>(
    canLoad && screen === "stats"
      ? [
        "/api/stats/heatmap",
        tzOffsetMinutes,
        initData,
        mockTelegramId,
        heatmapMetric,
        heatmapHabitId,
      ]
      : null,
    async () => {
      if (heatmapMetric === "habit" && !heatmapHabitId) {
        const year = currentYear;
        return {
          year,
          fromDate: `${year}-01-01`,
          toDate: `${year}-12-31`,
          metric: "habit",
          points: [],
        };
      }

      const qs = new URLSearchParams();
      qs.set("metric", heatmapMetric);
      if (heatmapMetric === "habit" && heatmapHabitId) qs.set("habitId", heatmapHabitId);
      const path = `/api/stats/heatmap?${qs.toString()}`;
      return apiFetch<HeatmapResponse>(path, initData, {
        tzOffsetMinutes,
        mockTelegramId,
      });
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  useEffect(() => {
    if (!canLoad) return;
    const t = setTimeout(() => {
      void mutate();
      void mutateHeatmap();
    }, msUntilNext4amLocal());
    return () => clearTimeout(t);
  }, [canLoad, mutate, mutateHeatmap]);

  useEffect(() => {
    if (screen !== "stats") {
      setNotesOpen(false);
    }
  }, [screen]);

  const [statsRange, setStatsRange] = useState<"ytd" | "30d">("ytd");
  const statsToDate = data?.date ?? new Date().toISOString().slice(0, 10);
  const statsFromDate = useMemo(() => {
    if (statsRange === "30d") return addDaysIso(statsToDate, -29);
    return `${statsToDate.slice(0, 4)}-01-01`;
  }, [statsRange, statsToDate]);

  const { data: statsSummary } = useSWR<StatsSummaryResponse>(
    canLoad && screen === "stats"
      ? ["/api/stats/summary", tzOffsetMinutes, initData, mockTelegramId, statsFromDate, statsToDate]
      : null,
    async () => {
      const qs = new URLSearchParams();
      qs.set("fromDate", statsFromDate);
      qs.set("toDate", statsToDate);
      return apiFetch<StatsSummaryResponse>(`/api/stats/summary?${qs.toString()}`, initData, {
        tzOffsetMinutes,
        mockTelegramId,
      });
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  type GoalsListResponse = {
    year: number;
    goals: Array<{ id: string; year: number; title: string; is_active: boolean; position: number }>;
  };

  type HabitsListResponse = {
    habits: Habit[];
  };

  const { data: goalsList, mutate: mutateGoalsList } = useSWR<GoalsListResponse>(
    canLoad && screen === "settings"
      ? ["/api/goals", tzOffsetMinutes, initData, mockTelegramId, currentYear]
      : null,
    async () => {
      const qs = new URLSearchParams();
      qs.set("year", String(currentYear));
      qs.set("includeInactive", "true");
      return apiFetch<GoalsListResponse>(`/api/goals?${qs.toString()}`, initData, {
        tzOffsetMinutes,
        mockTelegramId,
      });
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  const { data: habitsList, mutate: mutateHabitsList } = useSWR<HabitsListResponse>(
    canLoad && screen === "settings" ? ["/api/habits/list", tzOffsetMinutes, initData, mockTelegramId] : null,
    async () => {
      const qs = new URLSearchParams();
      qs.set("includeInactive", "true");
      return apiFetch<HabitsListResponse>(`/api/habits/list?${qs.toString()}`, initData, {
        tzOffsetMinutes,
        mockTelegramId,
      });
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [goalEdits, setGoalEdits] = useState<Record<string, string>>({});
  const [habitEdits, setHabitEdits] = useState<Record<string, string>>({});

  async function createGoal() {
    const title = newGoalTitle.trim();
    if (!title) return;
    setNewGoalTitle("");

    await apiFetch("/api/goals", initData, {
      tzOffsetMinutes,
      mockTelegramId,
      method: "POST",
      body: { title, year: currentYear },
    });

    await mutateGoalsList();
    await mutate();
  }

  async function saveGoalTitle(id: string) {
    const title = (goalEdits[id] ?? "").trim();
    if (!title) return;

    await fetch(new URL(`/api/goals/${id}`, window.location.origin).toString(), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-telegram-init-data": initData,
      },
      body: JSON.stringify({ title }),
    });

    await mutateGoalsList();
    await mutate();
  }

  async function toggleGoalActive(id: string, next: boolean) {
    await fetch(new URL(`/api/goals/${id}`, window.location.origin).toString(), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-telegram-init-data": initData,
      },
      body: JSON.stringify({ isActive: next }),
    });
    await mutateGoalsList();
    await mutate();
  }

  async function deactivateGoal(id: string) {
    await fetch(new URL(`/api/goals/${id}`, window.location.origin).toString(), {
      method: "DELETE",
      headers: {
        "x-telegram-init-data": initData,
      },
    });
    await mutateGoalsList();
    await mutate();
  }

  async function saveHabitTitle(id: string) {
    const title = (habitEdits[id] ?? "").trim();
    if (!title) return;

    await fetch(new URL(`/api/habits/${id}`, window.location.origin).toString(), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-telegram-init-data": initData,
      },
      body: JSON.stringify({ title }),
    });
    await mutateHabitsList();
    await mutate();
  }

  async function toggleHabitActive(id: string, next: boolean) {
    await fetch(new URL(`/api/habits/${id}`, window.location.origin).toString(), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-telegram-init-data": initData,
      },
      body: JSON.stringify({ isActive: next }),
    });
    await mutateHabitsList();
    await mutate();
  }

  async function moveHabit(id: string, dir: -1 | 1) {
    const list = habitsList?.habits ?? [];
    const ordered = [...list].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((h) => h.id === id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= ordered.length) return;
    const swapped = [...ordered];
    const tmp = swapped[idx];
    swapped[idx] = swapped[nextIdx];
    swapped[nextIdx] = tmp;

    await apiFetch("/api/habits/reorder", initData, {
      tzOffsetMinutes,
      mockTelegramId,
      method: "POST",
      body: { orderedIds: swapped.map((h) => h.id) },
    });

    await mutateHabitsList();
    await mutate();
  }
  
  const [digestTime, setDigestTime] = useState("");
  useEffect(() => {
    if (data?.digestTime) setDigestTime(data.digestTime);
  }, [data?.digestTime]);

  async function saveDigestTime() {
    if (!digestTime) return;
    await apiFetch("/api/user/settings", initData, {
      tzOffsetMinutes,
      mockTelegramId,
      method: "POST",
      body: { digestTime },
    });
    await mutate();
  }

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesItems, setNotesItems] = useState<NotesHistoryItem[]>([]);
  const [notesNextCursor, setNotesNextCursor] = useState<string | null | undefined>(undefined);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const loadMoreNotes = useCallback(async () => {
    if (!canLoad) return;
    if (notesLoading) return;
    if (notesNextCursor === null) return;

    setNotesLoading(true);
    setNotesError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "10");
      if (typeof notesNextCursor === "string" && notesNextCursor) qs.set("cursor", notesNextCursor);
      const path = `/api/day/notes?${qs.toString()}`;

      const res = await apiFetch<NotesHistoryResponse>(path, initData, {
        tzOffsetMinutes,
        mockTelegramId,
      });

      setNotesItems((prev) => [...prev, ...res.items]);
      setNotesNextCursor(res.nextCursor);
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setNotesLoading(false);
    }
  }, [canLoad, initData, mockTelegramId, notesLoading, notesNextCursor, tzOffsetMinutes]);

  useEffect(() => {
    if (!notesOpen) return;
    if (!canLoad) return;
    if (notesItems.length > 0) return;
    if (notesLoading) return;
    void loadMoreNotes();
  }, [notesOpen, canLoad, notesItems.length, notesLoading, loadMoreNotes]);

  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [showNewHabit, setShowNewHabit] = useState(false);
  const [journalText, setJournalText] = useState("");
  const [savingJournal, setSavingJournal] = useState(false);
  const [journalSaved, setJournalSaved] = useState(false);

  useEffect(() => {
    setJournalText(data?.dayLog?.journal_text ?? "");
  }, [data?.dayLog?.journal_text]);

  const completedSet = useMemo(
    () => new Set(data?.completedHabitIds ?? []),
    [data?.completedHabitIds],
  );

  async function createHabit() {
    const title = newHabitTitle.trim();
    if (!title) return;

    setNewHabitTitle("");

    await apiFetch("/api/habits/create", initData, {
      tzOffsetMinutes,
      mockTelegramId,
      method: "POST",
      body: { title },
    });

    await mutate();
    setShowNewHabit(false);
  }

  async function toggleHabit(habitId: string) {
    if (!data) return;

    const wasCompleted = completedSet.has(habitId);

    await mutate(
      {
        ...data,
        completedHabitIds: wasCompleted
          ? data.completedHabitIds.filter((id) => id !== habitId)
          : [...data.completedHabitIds, habitId],
      },
      { revalidate: false },
    );

    await apiFetch("/api/habits/toggle", initData, {
      tzOffsetMinutes,
      mockTelegramId,
      method: "POST",
      body: { habitId, date: selectedDate },
    });
  }

  async function setRating(kind: "efficiency" | "social", value: number) {
    if (!data) return;

    await mutate(
      {
        ...data,
        dayLog: {
          rating_efficiency: kind === "efficiency" ? value : (data.dayLog?.rating_efficiency ?? null),
          rating_social: kind === "social" ? value : (data.dayLog?.rating_social ?? null),
          journal_text: data.dayLog?.journal_text ?? null,
        },
      },
      { revalidate: false },
    );

    await apiFetch("/api/day/rate", initData, {
      tzOffsetMinutes,
      mockTelegramId,
      method: "POST",
      body: kind === "efficiency" ? { efficiency: value, date: selectedDate } : { social: value, date: selectedDate },
    });
  }

  async function saveJournal() {
    setSavingJournal(true);
    setJournalSaved(false);

    // Optimistic update for journal text
    await mutate(
      {
        ...data!,
        dayLog: {
          ...(data?.dayLog ?? { rating_efficiency: null, rating_social: null }),
          journal_text: journalText,
        },
      },
      { revalidate: false },
    );

    try {
      await apiFetch("/api/day/rate", initData, {
        tzOffsetMinutes,
        mockTelegramId,
        method: "POST",
        body: { journalText, date: selectedDate },
      });
      // specific revalidate if needed, but we trust local state
      setJournalSaved(true);
      setTimeout(() => setJournalSaved(false), 2000);
    } finally {
      setSavingJournal(false);
    }
  }

  function navigateDate(delta: number) {
    if (!data?.date) return;
    const d = new Date(`${data.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    const newDate = d.toISOString().slice(0, 10);
    setSelectedDate(newDate);
  }

  function goToToday() {
    setSelectedDate(null);
  }

  const displayDate = selectedDate ?? data?.date;
  const isPastDate = displayDate && data?.date && displayDate < data.date;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4 shadow-soft backdrop-blur">
        <div className="text-sm text-muted-foreground">Habits Tracker</div>
        <div className="mt-1 text-xl font-semibold tracking-tight">
          {data?.firstName ? `Салют, ${data.firstName}` : "Салют"}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigateDate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center">
            <div className="text-xs text-muted-foreground">
              {isPastDate ? "Выбранная дата:" : "Сегодня:"}
            </div>
            <div className={cn("text-sm font-medium", isPastDate && "text-primary")}>
              {displayDate ?? ""}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigateDate(1)}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        {isPastDate && (
          <div className="mt-2 text-center">
            <Button variant="secondary" size="sm" onClick={goToToday}>
              Вернуться к сегодняшнему дню
            </Button>
          </div>
        )}
      </div>

      {canLoad && (
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={screen === "home" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setScreen("home")}
          >
            Главная
          </Button>
          <Button
            variant={screen === "stats" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setScreen("stats")}
          >
            Статистика
          </Button>
          <Button
            variant={screen === "settings" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setScreen("settings")}
          >
            Настройки
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = "/birthdays"}
          >
            ДР
          </Button>
        </div>
      )}

      {isTelegram && !canLoad && (
        <Card>
          <CardHeader>
            <CardTitle>Загрузка…</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Ждём initData от Telegram…
            </div>
          </CardContent>
        </Card>
      )}

      {canLoad && screen === "stats" && (
        <Card>
          <CardHeader>
            <CardTitle>Статистика</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={statsRange === "ytd" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setStatsRange("ytd")}
              >
                С начала года
              </Button>
              <Button
                variant={statsRange === "30d" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setStatsRange("30d")}
              >
                30 дней
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="text-xs text-muted-foreground">Среднее</div>
                <div className="mt-1 text-lg font-semibold">
                  {statsSummary?.avgOverall !== null && statsSummary?.avgOverall !== undefined
                    ? statsSummary.avgOverall.toFixed(2)
                    : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="text-xs text-muted-foreground">Эфф.</div>
                <div className="mt-1 text-lg font-semibold">
                  {statsSummary?.avgEfficiency !== null && statsSummary?.avgEfficiency !== undefined
                    ? statsSummary.avgEfficiency.toFixed(2)
                    : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="text-xs text-muted-foreground">Соц.</div>
                <div className="mt-1 text-lg font-semibold">
                  {statsSummary?.avgSocial !== null && statsSummary?.avgSocial !== undefined
                    ? statsSummary.avgSocial.toFixed(2)
                    : "—"}
                </div>
              </div>
            </div>

            {(statsSummary?.streaks?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Серии (streaks)</div>
                <div className="space-y-2">
                  {(statsSummary?.streaks ?? []).map((s) => (
                    <div
                      key={s.habitId}
                      className="rounded-xl border border-border/60 bg-background/50 p-3"
                    >
                      <div className="text-sm font-medium">{s.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Текущая: {s.currentStreak} · Лучшая: {s.bestStreak} · Всего: {s.totalCompletions}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canLoad && screen === "stats" && (
        <Card>
          <CardHeader>
            <CardTitle>Heatmap {heatmap?.year ?? currentYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={heatmapMetric === "avg" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setHeatmapMetric("avg")}
                >
                  Среднее
                </Button>
                <Button
                  variant={heatmapMetric === "habits" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setHeatmapMetric("habits")}
                >
                  Привычки
                </Button>
                <Button
                  variant={heatmapMetric === "efficiency" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setHeatmapMetric("efficiency")}
                >
                  Эффективность
                </Button>
                <Button
                  variant={heatmapMetric === "social" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setHeatmapMetric("social")}
                >
                  Социальность
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={heatmapMetric === "habit" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setHeatmapMetric("habit")}
                >
                  Одна привычка
                </Button>
                <select
                  className="h-9 flex-1 appearance-none rounded-lg border border-border bg-background/50 px-2 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                  value={heatmapHabitId}
                  onChange={(e) => setHeatmapHabitId(e.target.value)}
                  disabled={heatmapMetric !== "habit"}
                >
                  <option value="">Выбери привычку…</option>
                  {(data?.habits ?? []).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.title}
                    </option>
                  ))}
                </select>
              </div>

              {heatmapMetric === "habit" && !heatmapHabitId && (
                <div className="text-xs text-muted-foreground">
                  Выбери привычку, чтобы построить heatmap.
                </div>
              )}
            </div>

            <Heatmap year={heatmap?.year ?? currentYear} points={heatmap?.points ?? []} />
          </CardContent>
        </Card>
      )}

      {!isTelegram && !canLoad && (
        <Card>
          <CardHeader>
            <CardTitle>Открывай из Telegram</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Для безопасности API ждёт Telegram initData.
            </div>
            <div className="text-sm text-muted-foreground">
              Для локального теста открой страницу с параметром
              <span className="font-mono"> ?mockTelegramId=123</span> и включи
              <span className="font-mono"> TELEGRAM_BYPASS_AUTH=true</span>.
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("mockTelegramId", "123");
                window.location.href = url.toString();
              }}
            >
              Включить demo
            </Button>
          </CardContent>
        </Card>
      )}

      {canLoad && screen === "home" && (
        <Card>
          <CardHeader>
            <CardTitle>Цели на {currentYear}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.yearGoals ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">Пока нет целей на год.</div>
            ) : (
              <div className="space-y-2">
                {(data?.yearGoals ?? []).map((g) => (
                  <div
                    key={g.id}
                    className="rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm"
                  >
                    {g.title}
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">Редактирование — в Настройках.</div>
          </CardContent>
        </Card>
      )}

      {canLoad && screen === "home" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Привычки</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewHabit((v) => !v);
                  setNewHabitTitle("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => mutate()}>
                <RefreshCw className="h-4 w-4" />
                Обновить
              </Button>
            </div>
          </CardHeader>
          {isPastDate && (
            <div className="px-4 pb-2">
              <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                Режим редактирования прошлых дней
              </div>
            </div>
          )}
          <CardContent className="space-y-3">
            {showNewHabit && (
              <div className="flex gap-2">
                <Input
                  value={newHabitTitle}
                  placeholder="Новая привычка (например, Чтение)"
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createHabit();
                  }}
                />
                <Button onClick={createHabit} className="shrink-0">
                  Добавить
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setNewHabitTitle("");
                    setShowNewHabit(false);
                  }}
                  className="shrink-0"
                >
                  Отмена
                </Button>
              </div>
            )}

            {isLoading && (
              <div className="text-sm text-muted-foreground">Загрузка…</div>
            )}

            {error && (
              <div className="text-sm text-red-500">{error.message}</div>
            )}

            <HabitsList
              habits={data?.habits ?? []}
              isCompleted={(id: string) => completedSet.has(id)}
              onToggle={toggleHabit}
            />
          </CardContent>
        </Card>
      )}

      {canLoad && screen === "home" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isPastDate ? "Оценка дня (редактирование)" : "Оценка дня"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RatingRow
              title="Эффективность"
              value={data?.dayLog?.rating_efficiency ?? null}
              onPick={(v) => setRating("efficiency", v)}
            />
            <RatingRow
              title="Социальность"
              value={data?.dayLog?.rating_social ?? null}
              onPick={(v) => setRating("social", v)}
            />
          </CardContent>
        </Card>
      )}

      {canLoad && screen === "home" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isPastDate ? "Итоги / заметка (редактирование)" : "Итоги / заметка"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={journalText}
              placeholder={isPastDate ? "Редактируй заметку за этот день..." : "Как прошёл день?"}
              onChange={(e) => setJournalText(e.target.value)}
            />
            <Button
              onClick={saveJournal}
              disabled={savingJournal}
              className={cn(
                "transition-all duration-300",
                journalSaved && "bg-green-600 hover:bg-green-700 text-white border-green-700"
              )}
            >
              {savingJournal ? "Сохраняю…" : journalSaved ? "Сохранено!" : "Сохранить"}
            </Button>
          </CardContent>
        </Card>
      )}

      {canLoad && screen === "stats" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Заметки за прошлые дни</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setNotesOpen((v) => !v)}>
              {notesOpen ? "Скрыть" : "Открыть"}
            </Button>
          </CardHeader>
          {notesOpen && (
            <CardContent className="space-y-3">
              {notesError && <div className="text-sm text-red-500">{notesError}</div>}

              {!notesLoading && notesItems.length === 0 && !notesError && (
                <div className="text-sm text-muted-foreground">
                  Пока нет заметок за прошлые дни.
                </div>
              )}

              {notesItems.length > 0 && (
                <div className="space-y-2">
                  {notesItems.map((n) => (
                    <div
                      key={n.date}
                      className="rounded-xl border border-border/60 bg-background/50 p-3"
                    >
                      <div className="text-xs text-muted-foreground">{n.date}</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm">{n.journalText}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {n.ratingEfficiency !== null ? `Эффективность: ${n.ratingEfficiency}` : ""}
                        {n.ratingEfficiency !== null && n.ratingSocial !== null ? " · " : ""}
                        {n.ratingSocial !== null ? `Социальность: ${n.ratingSocial}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="secondary"
                onClick={loadMoreNotes}
                disabled={notesLoading || notesNextCursor === null}
              >
                {notesLoading
                  ? "Загрузка…"
                  : notesNextCursor === null
                    ? "Больше нет"
                    : "Загрузить ещё"}
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {canLoad && screen === "settings" && (
        <Card>
          <CardHeader>
            <CardTitle>Настройки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-medium">Время утреннего дайджеста (МСК)</div>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                />
                <Button variant="secondary" onClick={saveDigestTime}>
                  Сохранить
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Бот пришлет список задач в это время.
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Цели на {currentYear}</div>
              <div className="flex gap-2">
                <Input
                  value={newGoalTitle}
                  placeholder="Новая цель на год"
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createGoal();
                  }}
                />
                <Button onClick={createGoal} className="shrink-0">
                  Добавить
                </Button>
              </div>

              {(goalsList?.goals ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">Пока нет целей.</div>
              )}

              {(goalsList?.goals ?? []).map((g) => (
                <div
                  key={g.id}
                  className={cn(
                    "rounded-xl border border-border/60 bg-background/50 p-3",
                    !g.is_active && "opacity-60",
                  )}
                >
                  <div className="flex gap-2">
                    <Input
                      value={goalEdits[g.id] ?? g.title}
                      onChange={(e) =>
                        setGoalEdits((prev) => ({
                          ...prev,
                          [g.id]: e.target.value,
                        }))
                      }
                    />
                    <Button variant="secondary" onClick={() => void saveGoalTitle(g.id)}>
                      Сохранить
                    </Button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {g.is_active ? (
                      <Button variant="secondary" onClick={() => void deactivateGoal(g.id)}>
                        Удалить
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => void toggleGoalActive(g.id, true)}>
                        Восстановить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Привычки</div>

              {(habitsList?.habits ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">Пока нет привычек.</div>
              )}

              {(habitsList?.habits ?? [])
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((h) => (
                  <div
                    key={h.id}
                    className={cn(
                      "rounded-xl border border-border/60 bg-background/50 p-3",
                      !h.is_active && "opacity-60",
                    )}
                  >
                    <div className="flex gap-2">
                      <Input
                        value={habitEdits[h.id] ?? h.title}
                        onChange={(e) =>
                          setHabitEdits((prev) => ({
                            ...prev,
                            [h.id]: e.target.value,
                          }))
                        }
                      />
                      <Button variant="secondary" onClick={() => void saveHabitTitle(h.id)}>
                        Сохранить
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => void toggleHabitActive(h.id, !h.is_active)}>
                        {h.is_active ? "Выключить" : "Включить"}
                      </Button>
                      <Button variant="secondary" onClick={() => void moveHabit(h.id, -1)}>
                        Вверх
                      </Button>
                      <Button variant="secondary" onClick={() => void moveHabit(h.id, 1)}>
                        Вниз
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="pb-8 text-center text-xs text-muted-foreground">
        Быстрый UI: без лишних сообщений, с оптимистичными обновлениями.
      </div>
    </div>
  );
}

function HabitsList({
  habits,
  isCompleted,
  onToggle,
}: {
  habits: Habit[];
  isCompleted: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  if (!habits.length) {
    return (
      <div className="text-sm text-muted-foreground">
        Пока нет привычек. Добавь первую.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {habits.map((h) => {
        const done = isCompleted(h.id);
        return (
          <button
            key={h.id}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-3 text-left transition hover:bg-muted/40",
              done && "border-primary/40",
            )}
            onClick={() => onToggle(h.id)}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{h.title}</div>
              <div className="text-xs text-muted-foreground">
                {done ? "Отмечено" : "Не отмечено"}
              </div>
            </div>
            <div className="shrink-0">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RatingRow({
  title,
  value,
  onPick,
}: {
  title: string;
  value: number | null;
  onPick: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => {
          const v = i + 1;
          const active = value === v;
          return (
            <button
              key={v}
              className={cn(
                "h-10 rounded-xl border border-border bg-background text-sm font-semibold transition hover:bg-muted",
                active && "border-primary bg-primary text-primary-foreground",
              )}
              onClick={() => onPick(v)}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
