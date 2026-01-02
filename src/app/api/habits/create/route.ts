import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  title: z.string().trim().min(1).max(80),
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

    const { data: maxPosRow, error: maxPosError } = await supabaseAdmin
      .from("habits")
      .select("position")
      .eq("user_id", user.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxPosError) throw maxPosError;

    const position = (maxPosRow?.position ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from("habits")
      .insert({ user_id: user.id, title: body.title, position, is_active: true })
      .select("id,title,is_active,position")
      .single();

    if (error) throw error;

    return Response.json({ ok: true, habit: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
