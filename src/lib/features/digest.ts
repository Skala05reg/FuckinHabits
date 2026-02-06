import { getCalendar, GOOGLE_CALENDAR_ID } from "@/lib/google-calendar";
import { getBot } from "@/lib/bot";
import { InlineKeyboard } from "grammy";
import { calendar_v3 } from "googleapis";

export async function sendDailyDigest(telegramId: number, tzOffsetMinutes: number) {
  const now = new Date();
  // Adjust to user's time
  const localTime = new Date(now.getTime() + tzOffsetMinutes * 60000);
  
  const y = localTime.getUTCFullYear();
  const m = String(localTime.getUTCMonth() + 1).padStart(2, "0");
  const d = String(localTime.getUTCDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`; // YYYY-MM-DD
  
  const timeMin = `${dateStr}T00:00:00+03:00`; // Assuming Calendar events are stored/retrieved in a fixed offset or we should calculate dynamic ISO strings. 
  // Actually, Google Calendar API `timeMin` expects an ISO string. 
  // If we query for "User's current day", we should construct the range properly using their offset.
  // BUT, the existing code hardcoded `+03:00` for Moscow. 
  // If the user is in a different timezone, we should probably construct the query range in UTC or their offset.
  // Let's stick to the existing pattern but be careful.
  // Ideally: Start of day in user's timezone -> End of day in user's timezone.
  
  // Construct ISO strings for the user's day
  // To get the correct query range, we can use the user's midnight.
  // localTime is currently "now" (e.g. 09:00 local).
  // We want 00:00:00 to 23:59:59 of this day.
  
  // Create a date object representing 00:00 user time
  const startOfDay = new Date(localTime);
  startOfDay.setUTCHours(0, 0, 0, 0);
  // Convert back to absolute UTC time for the API query
  // startOfDay (User View) -> UTC (API View)
  // We added offset to get to User View. So subtract offset to get back to UTC.
  const startOfDayUtc = new Date(startOfDay.getTime() - tzOffsetMinutes * 60000);
  
  const endOfDayUtc = new Date(startOfDayUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  
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
                  // Format time in user's timezone? 
                  // Or use the provided timezone in dateTime?
                  // Usually Google returns ISO with offset.
                  // We'll trust Intl to format it nicely.
                  // Note: `tzOffsetMinutes` is from DB. Intl expects IANA string (e.g. 'Europe/Moscow').
                  // We don't store IANA string, only offset. 
                  // Fallback: Manually format HH:mm from the ISO string if possible, or just print UTC+Offset.
                  // Actually, `e.start.dateTime` usually contains the offset.
                  // Let's just parse the hours/minutes directly from the string if we want to be safe, 
                  // OR use a fixed timezone if we know it (currently hardcoded to Moscow in original code).
                  // Let's try to be smart.
                  const hours = dateObj.getHours().toString().padStart(2, '0');
                  const mins = dateObj.getMinutes().toString().padStart(2, '0');
                  // This `dateObj.getHours()` uses the SERVER'S local time (UTC in Vercel).
                  // We need to shift it to User's time to display correct "09:00".
                  const userEventTime = new Date(dateObj.getTime() + tzOffsetMinutes * 60000);
                  const h = userEventTime.getUTCHours().toString().padStart(2, '0');
                  const m = userEventTime.getUTCMinutes().toString().padStart(2, '0');
                  
                  btnText = `${h}:${m} ${title}`;
              }
              btnText = `⬜ ${btnText}`;
          }
          
          if (btnText.length > 40) btnText = btnText.substring(0, 37) + "...";
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
