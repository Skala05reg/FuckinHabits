import { Bot } from "grammy";
import { calendar_v3 } from "googleapis";

import { APP_CONFIG } from "@/config/app";
import { BOT_CONFIG, isLikelyTaskListQuery } from "@/config/bot";
import { getDateInTimeZone, formatOffsetMinutes, shiftIsoDate } from "@/lib/date-time";
import { ensureUser } from "@/lib/db/users";
import { sendTaskListMessage } from "@/lib/features/task-lists";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";
import { classifyMessage } from "@/lib/agent/classifier";
import { getCalendar, GOOGLE_CALENDAR_ID } from "@/lib/google-calendar";
import { identifyEventsToDelete } from "@/lib/agent/deleter";
import { identifyEventToModify } from "@/lib/agent/modifier";
import {
  buildMiniAppKeyboard,
  getStartMiniAppLinks,
} from "@/lib/telegram/mini-apps";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

type GlobalWithBot = typeof globalThis & { __bot?: Bot };
const DEFAULT_TIMEZONE = APP_CONFIG.defaultCalendarTimeZone;
const DEFAULT_OFFSET = formatOffsetMinutes(APP_CONFIG.defaultCalendarOffsetMinutes);

function toDayRange(date: string): { timeMin: string; timeMax: string } {
  return {
    timeMin: `${date}T00:00:00${DEFAULT_OFFSET}`,
    timeMax: `${date}T23:59:59${DEFAULT_OFFSET}`,
  };
}

function toDateTimeWithDefaultOffset(date: string, time: string): string {
  return `${date}T${time}:00${DEFAULT_OFFSET}`;
}

export function getBot(): Bot {
  const g = globalThis as GlobalWithBot;
  if (g.__bot) return g.__bot;

  const bot = new Bot(requireEnv("TELEGRAM_BOT_TOKEN"));

  bot.command("start", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    try {
        await ensureUser({ telegramId, firstName: ctx.from?.first_name });

        const miniAppLinks = getStartMiniAppLinks(telegramId);
        const keyboard = buildMiniAppKeyboard(miniAppLinks);
        if (miniAppLinks.length) keyboard.row();
        keyboard.text(BOT_CONFIG.labels.showTodayTasks, BOT_CONFIG.callbacks.showTasksToday);

        await ctx.reply(
        miniAppLinks.length > 1
          ? "Выбери нужный Mini App. Стандартная кнопка бота открывает трекер привычек."
          : "Открой Mini App и отмечай привычки/оценки дня. Логический день длится до 04:00.",
        keyboard.inline_keyboard.length ? { reply_markup: keyboard } : undefined,
        );
    } catch (e) {
        console.error("Start command error:", e);
        await ctx.reply("❌ Произошла ошибка при регистрации. Попробуй позже.");
    }
  });

  async function sendTodayTasksForUser(telegramId: number, firstName?: string): Promise<void> {
    const user = await ensureUser({ telegramId, firstName });
    const supabaseAdmin = getSupabaseAdmin();
    const botRef = getBot();
    await botRef.init();

    await sendTaskListMessage({
      bot: botRef,
      supabase: supabaseAdmin,
      userId: user.id,
      telegramId: user.telegram_id,
      tzOffsetMinutes: user.tz_offset_minutes ?? 0,
    });
  }

  bot.command("tasks", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    try {
      await sendTodayTasksForUser(telegramId, ctx.from?.first_name);
    } catch (error) {
      console.error("Command /tasks error:", error);
      await ctx.reply("❌ Не удалось загрузить задачи.");
    }
  });

  bot.command("today", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    try {
      await sendTodayTasksForUser(telegramId, ctx.from?.first_name);
    } catch (error) {
      console.error("Command /today error:", error);
      await ctx.reply("❌ Не удалось загрузить задачи.");
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data === BOT_CONFIG.callbacks.showTasksToday) {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        await ctx.answerCallbackQuery("Не удалось определить пользователя");
        return;
      }

      try {
        await sendTodayTasksForUser(telegramId, ctx.from?.first_name);
        await ctx.answerCallbackQuery("Отправил список задач на сегодня");
      } catch (error) {
        console.error("Show-tasks callback error:", error);
        await ctx.answerCallbackQuery("Ошибка при загрузке задач");
      }
      return;
    }

    if (data.startsWith(BOT_CONFIG.callbacks.toggleEventPrefix)) {
      const eventId = data.slice(BOT_CONFIG.callbacks.toggleEventPrefix.length);
      if (!eventId) return;

      try {
        const cal = getCalendar();
        // 1. Get current event
        const event = await cal.events.get({
          calendarId: GOOGLE_CALENDAR_ID,
          eventId: eventId,
        });

        const currentSummary = event.data.summary || "";
        const isDone = currentSummary.startsWith("✅");
        
        let newSummary = currentSummary;
        if (isDone) {
            newSummary = currentSummary.replace(/^✅\s*/, "");
        } else {
            newSummary = `✅ ${currentSummary}`;
        }

        // 2. Patch event
        await cal.events.patch({
            calendarId: GOOGLE_CALENDAR_ID,
            eventId: eventId,
            requestBody: {
                summary: newSummary
            }
        });

        // 3. Update the button
        const keyboard = ctx.callbackQuery.message?.reply_markup?.inline_keyboard;
        if (keyboard) {
            for (const row of keyboard) {
                for (const btn of row) {
                    if ('callback_data' in btn && btn.callback_data === data) {
                        let newText = btn.text;
                        if (isDone) {
                             // Uncheck
                             if (newText.startsWith("✅ ")) {
                                 newText = newText.replace("✅ ", "⬜ ");
                             } else {
                                 newText = "⬜ " + newText;
                             }
                        } else {
                            // Check
                            if (newText.startsWith("⬜ ")) {
                                newText = newText.replace("⬜ ", "✅ ");
                            } else {
                                newText = "✅ " + newText;
                            }
                        }
                        btn.text = newText;
                    }
                }
            }
            
            await ctx.editMessageReplyMarkup({
                reply_markup: { inline_keyboard: keyboard }
            });
        }
        
        await ctx.answerCallbackQuery(isDone ? "Задача возвращена" : "Задача выполнена! 🎉");

      } catch (e) {
        console.error("Toggle event error", e);
        await ctx.answerCallbackQuery("Ошибка при обновлении задачи");
      }
    }
  });

  bot.on("message:text", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const text = ctx.message.text.trim();
    if (!text) return;

    await ctx.api.sendChatAction(ctx.chat.id, "typing");

    try {
      const user = await ensureUser({ telegramId, firstName: ctx.from?.first_name });
      const supabaseAdmin = getSupabaseAdmin();

      if (isLikelyTaskListQuery(text)) {
        await sendTaskListMessage({
          bot,
          supabase: supabaseAdmin,
          userId: user.id,
          telegramId: user.telegram_id,
          tzOffsetMinutes: user.tz_offset_minutes ?? 0,
        });
        return;
      }

      const classification = await classifyMessage(text);

      // --- 1. Schedule Event ---
      if (classification.intent === "schedule_event" && classification.scheduleDetails) {
        const { date, startTime, endTime, description } = classification.scheduleDetails;
        
        if (!startTime) {
          // All Day
          const nextDay = shiftIsoDate(date, 1);

          await getCalendar().events.insert({
            calendarId: GOOGLE_CALENDAR_ID,
            requestBody: {
              summary: description,
              start: { date: date },
              end: { date: nextDay },
            },
          });
          await ctx.reply(`✅ Запланировано (весь день): "${description}"\n📅 ${date}`);
        } else {
            // Timed
            const startT = startTime;
            let endT = endTime;
            if (!endT) {
              const [h, m] = startT.split(':').map(Number);
              const totalMins = h * 60 + m + APP_CONFIG.defaultEventDurationMinutes;
              const endH = Math.floor(totalMins / 60) % 24;
              const endM = totalMins % 60;
              endT = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
            }

            const startDateTime = toDateTimeWithDefaultOffset(date, startT);
            const endDateTime = toDateTimeWithDefaultOffset(date, endT);

            await getCalendar().events.insert({
            calendarId: GOOGLE_CALENDAR_ID,
            requestBody: {
                summary: description,
                start: { dateTime: startDateTime, timeZone: DEFAULT_TIMEZONE },
                end: { dateTime: endDateTime, timeZone: DEFAULT_TIMEZONE },
            },
            });

            await ctx.reply(`✅ Запланировано: "${description}"\n📅 ${date}\n⏰ ${startT} - ${endT}`);
        }
        return;
      } 

      // --- 2. Get Events ---
      if (classification.intent === "get_events") {
        const date = classification.scheduleDetails?.date ?? getDateInTimeZone(new Date(), DEFAULT_TIMEZONE);
        await sendTaskListMessage({
          bot,
          supabase: supabaseAdmin,
          userId: user.id,
          telegramId: user.telegram_id,
          tzOffsetMinutes: user.tz_offset_minutes ?? 0,
          date,
        });
        return;
      }
      
      // --- 3. Delete Event ---
      if (classification.intent === "delete_event" && classification.scheduleDetails) {
        const { date, description } = classification.scheduleDetails;
        if (!description) {
            await ctx.reply("🤔 Я не понял, какую именно задачу нужно удалить.");
            return;
        }

        const { timeMin, timeMax } = toDayRange(date);

        const res = await getCalendar().events.list({
          calendarId: GOOGLE_CALENDAR_ID,
          timeMin,
          timeMax,
          singleEvents: true,
        });

        const events = res.data.items || [];
        if (events.length === 0) {
          await ctx.reply(`📅 На ${date} нет задач, удалять нечего.`);
          return;
        }

        const simpleEvents = events.map(e => ({
            id: e.id || "",
            summary: e.summary || "No Title",
            start: e.start?.dateTime || e.start?.date || "No Time"
        })).filter(e => e.id);

        const idsToDelete = await identifyEventsToDelete(description, simpleEvents);

        if (idsToDelete.length === 0) {
            await ctx.reply(`❌ Не нашел на ${date} задач, подходящих под "${description}".`);
            return;
        }

        let deletedCount = 0;
        for (const id of idsToDelete) {
            try {
                await getCalendar().events.delete({
                    calendarId: GOOGLE_CALENDAR_ID,
                    eventId: id
                });
                deletedCount++;
            } catch (err) {
                console.error("Failed to delete event", id, err);
            }
        }

        await ctx.reply(`🗑️ Удалено задач: ${deletedCount}\n(По запросу "${description}")`);
        return;
      }

      // --- 4. Reschedule Event ---
      if (classification.intent === "reschedule_event" && classification.rescheduleDetails) {
        const { searchDate, targetDate, targetTime, description } = classification.rescheduleDetails;
        
        const dateToSearch = searchDate || getDateInTimeZone(new Date(), DEFAULT_TIMEZONE);
        const { timeMin, timeMax } = toDayRange(dateToSearch);

        const res = await getCalendar().events.list({
            calendarId: GOOGLE_CALENDAR_ID,
            timeMin,
            timeMax,
            singleEvents: true,
        });

        const events = res.data.items || [];
        if (events.length === 0) {
                await ctx.reply(`⚠️ На ${dateToSearch} задач не найдено. Уточни дату, откуда переносить.`);
                return;
        }

        const simpleEvents = events.map(e => ({
            id: e.id || "",
            summary: e.summary || "No Title",
            start: e.start?.dateTime || e.start?.date || "No Time"
        })).filter(e => e.id);

        const eventId = await identifyEventToModify(description, simpleEvents);
        if (!eventId) {
                await ctx.reply(`🤔 Не нашел подходящую задачу на ${dateToSearch} по запросу "${description}".`);
                return;
        }

        const originalEvent = events.find(e => e.id === eventId);
        if (!originalEvent) return;

        const requestBody: Partial<calendar_v3.Schema$Event> = {};
        
        if (originalEvent.start?.date) {
            // Was All-day
            if (targetTime) {
                // Become Timed
                const startDateTime = toDateTimeWithDefaultOffset(targetDate, targetTime);
                const [h, m] = targetTime.split(':').map(Number);
                const endH = (h + 1) % 24;
                const endT = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                const endDateTime = toDateTimeWithDefaultOffset(targetDate, endT);
                
                requestBody.start = { dateTime: startDateTime, timeZone: DEFAULT_TIMEZONE };
                requestBody.end = { dateTime: endDateTime, timeZone: DEFAULT_TIMEZONE };
            } else {
                // Stay All-day
                const nextDay = shiftIsoDate(targetDate, 1);
                
                requestBody.start = { date: targetDate };
                requestBody.end = { date: nextDay };
            }
        } else if (originalEvent.start?.dateTime) {
            // Was Timed
            const oldStart = new Date(originalEvent.start.dateTime);
            const oldEnd = new Date(originalEvent.end?.dateTime || oldStart);
            const durationMs = oldEnd.getTime() - oldStart.getTime();

            let newStartDateTime = "";
            if (targetTime) {
                newStartDateTime = toDateTimeWithDefaultOffset(targetDate, targetTime);
            } else {
                const timePart = originalEvent.start.dateTime.split('T')[1];
                newStartDateTime = `${targetDate}T${timePart}`;
            }

            const newStartObj = new Date(newStartDateTime);
            const newEndObj = new Date(newStartObj.getTime() + durationMs);
            
            requestBody.start = { dateTime: newStartDateTime, timeZone: DEFAULT_TIMEZONE };
            requestBody.end = { dateTime: newEndObj.toISOString(), timeZone: DEFAULT_TIMEZONE };
        }

        await getCalendar().events.patch({
            calendarId: GOOGLE_CALENDAR_ID,
            eventId: eventId,
            requestBody
        });

        await ctx.reply(`✅ Задача "${originalEvent.summary}" перенесена на ${targetDate}${targetTime ? ' ' + targetTime : ''}.`);
        return;
      }
      
      // --- 5. Mark Done ---
      if (classification.intent === "mark_done" && classification.scheduleDetails) {
        const { date, description } = classification.scheduleDetails;
        
        // Default to today if not specified (usually marking done today)
        const dateToSearch = date || getDateInTimeZone(new Date(), DEFAULT_TIMEZONE);
        
        const { timeMin, timeMax } = toDayRange(dateToSearch);

        const res = await getCalendar().events.list({
          calendarId: GOOGLE_CALENDAR_ID,
          timeMin,
          timeMax,
          singleEvents: true,
        });

        const events = res.data.items || [];
        if (events.length === 0) {
           await ctx.reply(`🤔 На ${dateToSearch} задач не найдено.`);
           return;
        }

        const simpleEvents = events.map(e => ({
            id: e.id || "",
            summary: e.summary || "No Title",
            start: e.start?.dateTime || e.start?.date || "No Time"
        })).filter(e => e.id);

        const eventId = await identifyEventToModify(description, simpleEvents);
        
        if (!eventId) {
            await ctx.reply(`🤔 Не нашел задачу "${description}" на ${dateToSearch}.`);
            return;
        }

        const event = events.find(e => e.id === eventId);
        if (!event) return;

        if (event.summary?.startsWith("✅")) {
            await ctx.reply(`✅ Задача "${event.summary}" уже отмечена выполненной.`);
            return;
        }

        const newSummary = `✅ ${event.summary}`;
        await getCalendar().events.patch({
            calendarId: GOOGLE_CALENDAR_ID,
            eventId: eventId,
            requestBody: { summary: newSummary }
        });

        await ctx.reply(`🎉 Отметил задачу выполненной:\n${newSummary}`);
        return;
      }
      
      // --- 6. Other / Journal ---
      if (classification.intent === "other") {
        await ctx.reply("🤔 Я не уверен, что с этим делать. Это не похоже на задачу для календаря или запись в дневник.");
        return;
      }

      // Default to Journal
      const tzOffsetMinutes = user.tz_offset_minutes ?? 0;
      const logicalDate = getLogicalDate(new Date(), tzOffsetMinutes);
      const { error } = await supabaseAdmin
        .from("daily_logs")
        .upsert(
          {
            user_id: user.id,
            date: logicalDate,
            journal_text: text,
          },
          { onConflict: "user_id,date" },
        );

      if (error) {
        throw new Error(`Supabase error (journal upsert): ${error.message}`);
      }
      await ctx.reply("✍️ Записал в дневник.");

    } catch (e) {
      console.error("Error processing message:", e);
      if (e instanceof Error) console.error(e.stack);
      await ctx.reply("❌ Произошла ошибка при обработке сообщения. Проверь логи.");
    }
  });

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof Error) {
      console.error(e.message);
      console.error(e.stack);
    } else {
      console.error("Unknown error:", JSON.stringify(e, null, 2));
    }
  });

  g.__bot = bot;
  return bot;
}
