import { Bot, InlineKeyboard } from "grammy";

import { ensureUser } from "@/lib/db/users";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";
import { classifyMessage } from "@/lib/agent/classifier";
import { getCalendar, GOOGLE_CALENDAR_ID } from "@/lib/google-calendar";
import { identifyEventsToDelete } from "@/lib/agent/deleter";
import { identifyEventToModify } from "@/lib/agent/modifier";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

type GlobalWithBot = typeof globalThis & { __bot?: Bot };

export function getBot(): Bot {
  const g = globalThis as GlobalWithBot;
  if (g.__bot) return g.__bot;

  const bot = new Bot(requireEnv("TELEGRAM_BOT_TOKEN"));

  bot.command("start", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    try {
        await ensureUser({ telegramId, firstName: ctx.from?.first_name });

        const appUrl = process.env.WEBAPP_URL;
        const keyboard = new InlineKeyboard();
        if (appUrl) keyboard.webApp("Открыть трекер", appUrl);

        await ctx.reply(
        "Открой Mini App и отмечай привычки/оценки дня. Логический день длится до 04:00.",
        keyboard.inline_keyboard.length ? { reply_markup: keyboard } : undefined,
        );
    } catch (e) {
        console.error("Start command error:", e);
        await ctx.reply("❌ Произошла ошибка при регистрации. Попробуй позже.");
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith("toggle_event:")) {
      const eventId = data.split(":")[1];
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
      const classification = await classifyMessage(text);
      console.log("Message classification:", classification);

      // --- 1. Schedule Event ---
      if (classification.intent === "schedule_event" && classification.scheduleDetails) {
        const { date, startTime, endTime, description } = classification.scheduleDetails;
        
        if (!startTime) {
          // All Day
          const d = new Date(date);
          d.setDate(d.getDate() + 1);
          const nextDay = d.toISOString().split('T')[0];

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
              const totalMins = h * 60 + m + 30;
              const endH = Math.floor(totalMins / 60) % 24;
              const endM = totalMins % 60;
              endT = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
            }

            const startDateTime = `${date}T${startT}:00+03:00`;
            const endDateTime = `${date}T${endT}:00+03:00`;

            await getCalendar().events.insert({
            calendarId: GOOGLE_CALENDAR_ID,
            requestBody: {
                summary: description,
                start: { dateTime: startDateTime, timeZone: "Europe/Moscow" },
                end: { dateTime: endDateTime, timeZone: "Europe/Moscow" },
            },
            });

            await ctx.reply(`✅ Запланировано: "${description}"\n📅 ${date}\n⏰ ${startT} - ${endT}`);
        }
        return;
      } 

      // --- 2. Get Events ---
      if (classification.intent === "get_events" && classification.scheduleDetails?.date) {
        const date = classification.scheduleDetails.date;
        const timeMin = `${date}T00:00:00+03:00`;
        const timeMax = `${date}T23:59:59+03:00`;

        const res = await getCalendar().events.list({
          calendarId: GOOGLE_CALENDAR_ID,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = res.data.items || [];
        if (events.length === 0) {
          await ctx.reply(`📅 На ${date} задач нет.`);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const timed: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allDay: any[] = [];

        for (const e of events) {
            if (e.start?.dateTime) timed.push(e);
            else if (e.start?.date) allDay.push(e);
        }

        let msg = `📅 *Задачи на ${date}*\n\n`;

        if (timed.length > 0) {
            for (const e of timed) {
                const dateObj = new Date(e.start!.dateTime!);
                const start = new Intl.DateTimeFormat('ru-RU', { 
                    timeZone: 'Europe/Moscow', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }).format(dateObj);
                msg += `▫️ ${start} — ${e.summary}\n`;
            }
            if (allDay.length > 0) msg += "\n";
        }

        if (allDay.length > 0) {
            for (const e of allDay) {
                msg += `▫️ ${e.summary}\n`;
            }
        }
        await ctx.reply(msg, { parse_mode: "Markdown" });
        return;
      }
      
      // --- 3. Delete Event ---
      if (classification.intent === "delete_event" && classification.scheduleDetails) {
        const { date, description } = classification.scheduleDetails;
        if (!description) {
            await ctx.reply("🤔 Я не понял, какую именно задачу нужно удалить.");
            return;
        }

        const timeMin = `${date}T00:00:00+03:00`;
        const timeMax = `${date}T23:59:59+03:00`;

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
        
        const dateToSearch = searchDate || new Date().toISOString().split('T')[0];
        const timeMin = `${dateToSearch}T00:00:00+03:00`;
        const timeMax = `${dateToSearch}T23:59:59+03:00`;

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestBody: any = {};
        
        if (originalEvent.start?.date) {
            // Was All-day
            if (targetTime) {
                // Become Timed
                const startDateTime = `${targetDate}T${targetTime}:00+03:00`;
                const [h, m] = targetTime.split(':').map(Number);
                const endH = (h + 1) % 24;
                const endT = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                const endDateTime = `${targetDate}T${endT}:00+03:00`;
                
                requestBody.start = { dateTime: startDateTime, timeZone: "Europe/Moscow" };
                requestBody.end = { dateTime: endDateTime, timeZone: "Europe/Moscow" };
            } else {
                // Stay All-day
                const d = new Date(targetDate);
                d.setDate(d.getDate() + 1);
                const nextDay = d.toISOString().split('T')[0];
                
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
                newStartDateTime = `${targetDate}T${targetTime}:00+03:00`;
            } else {
                const timePart = originalEvent.start.dateTime.split('T')[1];
                newStartDateTime = `${targetDate}T${timePart}`;
            }

            const newStartObj = new Date(newStartDateTime);
            const newEndObj = new Date(newStartObj.getTime() + durationMs);
            
            requestBody.start = { dateTime: newStartDateTime, timeZone: "Europe/Moscow" };
            requestBody.end = { dateTime: newEndObj.toISOString(), timeZone: "Europe/Moscow" };
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
        const dateToSearch = date || new Date().toISOString().split('T')[0];
        
        const timeMin = `${dateToSearch}T00:00:00+03:00`;
        const timeMax = `${dateToSearch}T23:59:59+03:00`;

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
      const supabaseAdmin = getSupabaseAdmin();

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
