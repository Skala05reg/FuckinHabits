"use client";

import { CheckCircle2, Circle, Plus, RefreshCw } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, type Habit, type HeatmapResponse, type UserStatus } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { getTelegramWebApp } from "@/lib/telegram/webapp";
import { useEffect, useMemo, useState } from "react";

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
  for (let d = new Date(start); d <= end; ) {
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

export default function AppShell() {
  const { initData, isTelegram } = useTelegramInitData();
  const tzOffsetMinutes = useMemo(() => getTzOffsetMinutesClient(), []);
  const [mockTelegramId, setMockTelegramId] = useState<string | null>(null);

  useEffect(() => {
    setMockTelegramId(getMockTelegramIdFromUrl());
  }, []);

  const canLoad = initData.length > 0 || !!mockTelegramId;

  const { data, error, isLoading, mutate } = useSWR<UserStatus>(
    canLoad ? ["/api/user/status", tzOffsetMinutes, initData, mockTelegramId] : null,
    async () =>
      apiFetch<UserStatus>("/api/user/status", initData, {
        tzOffsetMinutes,
        mockTelegramId,
      }),
    {
      revalidateOnFocus: false,
    },
  );

  const [heatmapMetric, setHeatmapMetric] = useState<
    "avg" | "efficiency" | "social" | "habits" | "habit"
  >("avg");
  const [heatmapHabitId, setHeatmapHabitId] = useState<string>("");

  const { data: heatmap, mutate: mutateHeatmap } = useSWR<HeatmapResponse>(
    canLoad
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
        const year = new Date().getFullYear();
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

  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [journalText, setJournalText] = useState("");
  const [savingJournal, setSavingJournal] = useState(false);

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

    try {
      await apiFetch("/api/habits/toggle", initData, {
        tzOffsetMinutes,
        mockTelegramId,
        method: "POST",
        body: { habitId },
      });
    } finally {
      await mutate();
    }
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
      body: kind === "efficiency" ? { efficiency: value } : { social: value },
    });

    await mutate();
  }

  async function saveJournal() {
    setSavingJournal(true);
    try {
      await apiFetch("/api/day/rate", initData, {
        tzOffsetMinutes,
        mockTelegramId,
        method: "POST",
        body: { journalText },
      });
      await mutate();
    } finally {
      setSavingJournal(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4 shadow-soft backdrop-blur">
        <div className="text-sm text-muted-foreground">Habits Tracker</div>
        <div className="mt-1 text-xl font-semibold tracking-tight">Трекер</div>
        <div className="mt-2 text-xs text-muted-foreground">
          {data?.date ? `Сегодня: ${data.date}` : ""}
        </div>
      </div>

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

      {canLoad && (
        <Card>
          <CardHeader>
            <CardTitle>
              Heatmap {heatmap?.year ?? new Date().getFullYear()}
            </CardTitle>
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
                  className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-sm"
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

            <Heatmap
              year={heatmap?.year ?? new Date().getFullYear()}
              points={heatmap?.points ?? []}
            />
          </CardContent>
        </Card>
      )}

      {canLoad && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Привычки</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => mutate()}>
              <RefreshCw className="h-4 w-4" />
              Обновить
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
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
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </div>

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

      {canLoad && (
        <Card>
          <CardHeader>
            <CardTitle>Оценка дня</CardTitle>
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

      {canLoad && (
        <Card>
          <CardHeader>
            <CardTitle>Итоги / заметка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={journalText}
              placeholder="Как прошёл день?"
              onChange={(e) => setJournalText(e.target.value)}
            />
            <Button onClick={saveJournal} disabled={savingJournal}>
              {savingJournal ? "Сохраняю…" : "Сохранить"}
            </Button>
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
