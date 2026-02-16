import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calendar_v3 } from "googleapis";

import { APP_CONFIG } from "@/config/app";
import { BOT_CONFIG } from "@/config/bot";
import {
  deleteTrackedBotMessagesByIds,
  listTrackedBotMessages,
  trackBotMessage,
} from "@/lib/db/bot-messages";
import { getCalendar, GOOGLE_CALENDAR_ID } from "@/lib/google-calendar";

function getLocalDateByOffset(nowUtc: Date, tzOffsetMinutes: number): string {
  const localMs = nowUtc.getTime() + tzOffsetMinutes * 60_000;
  const local = new Date(localMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getUtcRangeForLocalDate(date: string, tzOffsetMinutes: number): { timeMinIso: string; timeMaxIso: string } {
  const localStart = new Date(`${date}T00:00:00.000Z`);
  const startUtc = new Date(localStart.getTime() - tzOffsetMinutes * 60_000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60_000 - 1);
  return { timeMinIso: startUtc.toISOString(), timeMaxIso: endUtc.toISOString() };
}

function sortEventsForTaskList(events: calendar_v3.Schema$Event[]): calendar_v3.Schema$Event[] {
  const timed: calendar_v3.Schema$Event[] = [];
  const allDay: calendar_v3.Schema$Event[] = [];
  for (const event of events) {
    if (event.start?.dateTime) timed.push(event);
    else if (event.start?.date) allDay.push(event);
  }
  timed.sort((a, b) => (a.start?.dateTime || "").localeCompare(b.start?.dateTime || ""));
  return [...timed, ...allDay];
}

function formatButtonText(event: calendar_v3.Schema$Event, tzOffsetMinutes: number): string {
  const title = event.summary || "Без названия";
  const isDone = title.startsWith("✅");
  let text = title;

  if (!isDone && event.start?.dateTime) {
    const eventDate = new Date(event.start.dateTime);
    const shifted = new Date(eventDate.getTime() + tzOffsetMinutes * 60_000);
    const hh = String(shifted.getUTCHours()).padStart(2, "0");
    const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
    text = `${hh}:${mm} ${title}`;
  }

  if (!isDone) {
    text = `⬜ ${text}`;
  }

  if (text.length > APP_CONFIG.telegramButtonTextLimit) {
    text = `${text.slice(0, APP_CONFIG.telegramButtonTextTruncateTo)}...`;
  }
  return text;
}

async function removePreviousTaskListMessages(params: {
  bot: Bot;
  supabase: SupabaseClient;
  userId: string;
  telegramId: number;
}): Promise<void> {
  const { bot, supabase, userId, telegramId } = params;
  const tracked = await listTrackedBotMessages(supabase, {
    userId,
    messageKind: BOT_CONFIG.messageKinds.taskList,
    limit: BOT_CONFIG.maxTrackedTaskListMessages,
  });
  if (!tracked.length) return;

  await Promise.allSettled(
    tracked.map((row) =>
      bot.api.deleteMessage(telegramId, Number(row.message_id)),
    ),
  );
  await deleteTrackedBotMessagesByIds(
    supabase,
    tracked.map((row) => row.id),
  );
}

export async function sendTaskListMessage(params: {
  bot: Bot;
  supabase: SupabaseClient;
  userId: string;
  telegramId: number;
  tzOffsetMinutes: number;
  date?: string;
}): Promise<{ sent: boolean; count: number; date: string }> {
  const { bot, supabase, userId, telegramId, tzOffsetMinutes } = params;
  const date = params.date ?? getLocalDateByOffset(new Date(), tzOffsetMinutes);
  const { timeMinIso, timeMaxIso } = getUtcRangeForLocalDate(date, tzOffsetMinutes);

  const res = await getCalendar().events.list({
    calendarId: GOOGLE_CALENDAR_ID,
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = res.data.items || [];
  const sorted = sortEventsForTaskList(events);

  await removePreviousTaskListMessages({ bot, supabase, userId, telegramId });

  if (!sorted.length) {
    const emptyMessage = await bot.api.sendMessage(
      telegramId,
      `${BOT_CONFIG.labels.tasksEmpty}\n${BOT_CONFIG.labels.tasksDatePrefix} ${date}`,
    );
    await trackBotMessage(supabase, {
      userId,
      messageKind: BOT_CONFIG.messageKinds.taskList,
      messageId: emptyMessage.message_id,
    });
    return { sent: true, count: 0, date };
  }

  const keyboard = new InlineKeyboard();
  for (const event of sorted) {
    if (!event.id) continue;
    keyboard
      .text(
        formatButtonText(event, tzOffsetMinutes),
        `${BOT_CONFIG.callbacks.toggleEventPrefix}${event.id}`,
      )
      .row();
  }

  const lines = [
    `${BOT_CONFIG.labels.tasksHeading}`,
    `${BOT_CONFIG.labels.tasksDatePrefix} ${date}`,
    BOT_CONFIG.labels.tasksHint,
  ];
  const sent = await bot.api.sendMessage(telegramId, lines.join("\n"), {
    reply_markup: keyboard,
  });

  await trackBotMessage(supabase, {
    userId,
    messageKind: BOT_CONFIG.messageKinds.taskList,
    messageId: sent.message_id,
  });

  return { sent: true, count: sorted.length, date };
}
