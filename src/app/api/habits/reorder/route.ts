import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(200),
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

    const { data: rows, error: listErr } = await supabaseAdmin
      .from("habits")
      .select("id")
      .eq("user_id", user.id)
      .in("id", body.orderedIds);

    if (listErr) throw listErr;

    const existing = new Set((rows ?? []).map((r) => String((r as { id: unknown }).id)));
    for (const id of body.orderedIds) {
      if (!existing.has(id)) throw new Error("Habit not found");
    }

    for (let i = 0; i < body.orderedIds.length; i += 1) {
      const id = body.orderedIds[i];
      const { error } = await supabaseAdmin.from("habits").update({ position: i }).eq("id", id);
      if (error) throw error;
    }

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
