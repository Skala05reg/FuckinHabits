import { APP_CONFIG } from "@/config/app";
import { getCalendar, GOOGLE_CALENDAR_ID } from "@/lib/google-calendar";
import { getBot } from "@/lib/bot";
import { InlineKeyboard } from "grammy";
import { calendar_v3 } from "googleapis";

export async function sendDailyDigest(telegramId: number, tzOffsetMinutes: number) {
  const now = new Date();
  const localTime = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  
  const y = localTime.getUTCFullYear();
  const m = String(localTime.getUTCMonth() + 1).padStart(2, "0");
  const d = String(localTime.getUTCDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;

  const startOfDay = new Date(localTime);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startOfDayUtc = new Date(startOfDay.getTime() - tzOffsetMinutes * 60_000);
  
  const endOfDayUtc = new Date(startOfDayUtc.getTime() + 24 * 60 * 60_000 - 1);
  
  const timeMinIso = startOfDayUtc.toISOString();
  const timeMaxIso = endOfDayUtc.toISOString();

  try {
      const res = await getCalendar().events.list({
          calendarId: GOOGLE_CALENDAR_ID,
          timeMin: timeMinIso,
          timeMax: timeMaxIso,
          singleEvents: true,
          orderBy: 'startTime',
      });

      const events = res.data.items || [];
      const bot = getBot();
      await bot.init();

      if (events.length === 0) {
           await bot.api.sendMessage(telegramId, `📅 На сегодня (${dateStr}) задач нет! Отдыхай.`);
           return true;
      }

      const keyboard = new InlineKeyboard();
      const timed: calendar_v3.Schema$Event[] = [];
      const allDay: calendar_v3.Schema$Event[] = [];

      for (const e of events) {
          if (e.start?.dateTime) timed.push(e);
          else if (e.start?.date) allDay.push(e);
      }
      timed.sort((a, b) => (a.start?.dateTime || "").localeCompare(b.start?.dateTime || ""));

      const sortedEvents = [...timed, ...allDay];

      const displayDate = `${d}.${m}.${y}`;
      const msg = `📅 *План на сегодня* (${displayDate})
👇 Нажимай на кнопки, чтобы отметить выполненным.`;

      for (const e of sortedEvents) {
          if (!e.id) continue;
          
          const title = e.summary || "Без названия";
          const isDone = title.startsWith("✅");
          
          let btnText = title;
          if (!isDone) {
              if (e.start?.dateTime) {
                  const dateObj = new Date(e.start.dateTime);
                  const userEventTime = new Date(dateObj.getTime() + tzOffsetMinutes * 60_000);
                  const h = userEventTime.getUTCHours().toString().padStart(2, '0');
                  const m = userEventTime.getUTCMinutes().toString().padStart(2, '0');
                  
                  btnText = `${h}:${m} ${title}`;
              }
              btnText = `⬜ ${btnText}`;
          }
          
          if (btnText.length > APP_CONFIG.telegramButtonTextLimit) {
            btnText = `${btnText.substring(0, APP_CONFIG.telegramButtonTextTruncateTo)}...`;
          }
          keyboard.text(btnText, `toggle_event:${e.id}`).row();
      }

      await bot.api.sendMessage(telegramId, msg, { 
          parse_mode: "Markdown",
          reply_markup: keyboard
      });

      return true;

  } catch (e) {
      console.error("Error sending daily digest:", e);
      return false;
  }
}
