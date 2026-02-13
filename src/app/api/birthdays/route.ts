import { z } from "zod";
import { NextResponse } from "next/server";
import { getTelegramAuthOrThrow } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BirthdayBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  try {
    const { telegramId, firstName } = await getTelegramAuthOrThrow(request);
    const user = await ensureUser({ telegramId, firstName });

    const supabase = getSupabaseAdmin();
    const { data: birthdays, error } = await supabase
      .from("birthdays")
      .select("id,name,date,created_at,user_id")
      .eq("user_id", user.id)
      .order("date", { ascending: true }); // We might want to sort by MM-DD in code

    if (error) {
      console.error("Error fetching birthdays:", error);
      return NextResponse.json({ error: "Failed to fetch birthdays" }, { status: 500 });
    }

    // Sort by upcoming logic can be done here or on client.
    // Let's do it on client for simplicity sending raw data mostly.

    return NextResponse.json({ birthdays });
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("API Error", error);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const { telegramId, firstName } = await getTelegramAuthOrThrow(request);
    const user = await ensureUser({ telegramId, firstName });

    const { name, date } = BirthdayBodySchema.parse(await request.json());

    const supabase = getSupabaseAdmin();
    const { data: created, error } = await supabase
      .from("birthdays")
      .insert({
        user_id: user.id,
        name,
        date, // YYYY-MM-DD
      })
      .select("id,name,date,created_at,user_id")
      .single();

    if (error) {
      console.error("Error creating birthday:", error);
      return NextResponse.json({ error: "Failed to create birthday" }, { status: 500 });
    }

    return NextResponse.json({ birthday: created });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("API Error", e);
    const status = msg.includes("initData") || msg.includes("telegram") ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
