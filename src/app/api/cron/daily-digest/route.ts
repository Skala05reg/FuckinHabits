import { APP_CONFIG } from "@/config/app";
import { NextResponse } from "next/server";
import { getCalendar, GOOGLE_CALENDAR_ID } from "@/lib/google-calendar";
import { getBot } from "@/lib/bot";
import { requireCronAuth } from "@/lib/cron-auth";
import { formatOffsetMinutes, getDateInTimeZone } from "@/lib/date-time";
import { calendar_v3 } from "googleapis";
import { InlineKeyboard } from "grammy";

export const dynamic = "force-dynamic";

async function runDailyDigest(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) {
      return new NextResponse("TELEGRAM_USER_ID not set", { status: 500 });
  }

  const now = new Date();
  const timeZone = APP_CONFIG.defaultCalendarTimeZone;
  const moscowDateStr = getDateInTimeZone(now, timeZone);
  const offsetStr = formatOffsetMinutes(APP_CONFIG.defaultCalendarOffsetMinutes);
  
  const timeMin = `${moscowDateStr}T00:00:00${offsetStr}`;
  const timeMax = `${moscowDateStr}T23:59:59${offsetStr}`;

  try {
      const res = await getCalendar().events.list({
          calendarId: GOOGLE_CALENDAR_ID,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
      });

      const events = res.data.items || [];
          if (events.length === 0) {
           const bot = getBot();
           await bot.init();
           await bot.api.sendMessage(userId, `📅 На сегодня (${moscowDateStr}) задач нет! Отдыхай.`);
           return NextResponse.json({ sent: true, count: 0 });
      }

      // Filter events that are already marked done (start with ✅)
      // Actually, let's show them as done or filter them out? 
      // Let's show all, but checked ones will have a tick.
      
      const keyboard = new InlineKeyboard();
      
      // Sort: timed first
      const timed: calendar_v3.Schema$Event[] = [];
      const allDay: calendar_v3.Schema$Event[] = [];

      for (const e of events) {
          if (e.start?.dateTime) timed.push(e);
          else if (e.start?.date) allDay.push(e);
      }
      timed.sort((a, b) => (a.start?.dateTime || "").localeCompare(b.start?.dateTime || ""));

      const sortedEvents = [...timed, ...allDay];

      const msg = `📅 *План на сегодня* (${moscowDateStr.split("-").reverse().join(".")})\n👇 Нажимай на кнопки, чтобы отметить выполненным.`;

      for (const e of sortedEvents) {
          if (!e.id) continue;
          
          const title = e.summary || "Без названия";
          const isDone = title.startsWith("✅");
          
          let btnText = title;
          if (!isDone) {
              // Add time if it's a timed event
              if (e.start?.dateTime) {
                  const dateObj = new Date(e.start.dateTime);
                  const time = new Intl.DateTimeFormat("ru-RU", { 
                      timeZone,
                      hour: "2-digit", 
                      minute: "2-digit" 
                  }).format(dateObj);
                  btnText = `${time} ${title}`;
              }
              btnText = `⬜ ${btnText}`;
          } else {
             btnText = title; // Already has ✅
          }

          // Limit button text length (Telegram limit is 64 bytes for data, text can be longer but looks bad)
          if (btnText.length > APP_CONFIG.telegramButtonTextLimit) {
            btnText = `${btnText.substring(0, APP_CONFIG.telegramButtonTextTruncateTo)}...`;
          }

          keyboard.text(btnText, `toggle_event:${e.id}`).row();
      }

      const bot = getBot();
      await bot.init();
      await bot.api.sendMessage(userId, msg, { 
          parse_mode: "Markdown",
          reply_markup: keyboard
      });

      return NextResponse.json({ sent: true, count: events.length });

  } catch (e) {
      console.error(e);
      return new NextResponse("Error fetching calendar", { status: 500 });
  }
}

export async function GET(request: Request) {
  return runDailyDigest(request);
}

export async function POST(request: Request) {
  return runDailyDigest(request);
}
