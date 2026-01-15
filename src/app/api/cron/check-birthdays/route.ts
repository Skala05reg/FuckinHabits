import { getBot } from "@/lib/bot";
import { getSupabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const secret = request.headers.get("x-cron-secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return new Response("Unauthorized", { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const bot = getBot();
    await bot.init();

    // 0. Calculate target day/month (Moscow Time)
    const now = new Date();
    const moscowDateStr = now.toLocaleDateString("en-US", { timeZone: "Europe/Moscow" });
    const moscowDate = new Date(moscowDateStr);

    const targetMonth = moscowDate.getMonth(); // 0-11
    const targetDate = moscowDate.getDate();   // 1-31

    // 1. Fetch all birthdays
    const { data: birthdays, error } = await supabase
        .from("birthdays")
        .select("*, users!inner(telegram_id)");

    if (error) {
        console.error("Error fetching birthdays", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const matches = (birthdays || []).filter((b: { date: string }) => {
        const d = new Date(b.date);
        return d.getMonth() === targetMonth && d.getDate() === targetDate;
    });

    console.log(`Checking birthdays for Mosow: ${moscowDateStr}. Found ${matches.length} matches.`);

    const results = [];

    for (const b of matches) {
        if (b.users && b.users.telegram_id) {
            try {
                await bot.api.sendMessage(
                    b.users.telegram_id,
                    ` Йоу! У ${b.name} сегодня День Рождения! Поздравь его! 🎉`
                );
                results.push({ sent: true, name: b.name, user: b.user_id });
            } catch (err) {
                console.error(`Failed to send to ${b.users.telegram_id}`, err);
                results.push({ sent: false, name: b.name, error: String(err) });
            }
        }
    }

    return NextResponse.json({
        processed: matches.length,
        sent: results.length,
        details: results
    });
}
