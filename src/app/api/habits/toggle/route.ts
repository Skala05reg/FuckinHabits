import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  habitId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const body = BodySchema.parse(await request.json());
    const supabaseAdmin = getSupabaseAdmin();

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const date = body.date ?? getLogicalDate(new Date(), tzOffsetMinutes);

    const { data: habit, error: habitError } = await supabaseAdmin
      .from("habits")
      .select("id")
      .eq("id", body.habitId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (habitError) throw habitError;
    if (!habit) throw new Error("Habit not found");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("habit_completions")
      .select("id")
      .eq("user_id", user.id)
      .eq("habit_id", body.habitId)
      .eq("date", date)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const { error: deleteError } = await supabaseAdmin
        .from("habit_completions")
        .delete()
        .eq("id", existing.id);
      if (deleteError) throw deleteError;
      return Response.json({ ok: true, completed: false, date });
    }

    const { error: insertError } = await supabaseAdmin.from("habit_completions").insert({
      user_id: user.id,
      habit_id: body.habitId,
      date,
    });

    if (insertError) throw insertError;

    return Response.json({ ok: true, completed: true, date });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
