import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const HabitRow = z.object({
  id: z.string(),
  title: z.string(),
  is_active: z.boolean(),
  position: z.number(),
});

export async function GET(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const supabaseAdmin = getSupabaseAdmin();

    const url = new URL(request.url);
    const { includeInactive } = QuerySchema.parse({
      includeInactive: url.searchParams.get("includeInactive") ?? undefined,
    });

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    let q = supabaseAdmin
      .from("habits")
      .select("id,title,is_active,position")
      .eq("user_id", user.id)
      .order("position", { ascending: true });

    if (!includeInactive) {
      q = q.eq("is_active", true);
    }

    const { data, error } = await q;
    if (error) throw error;

    const habits = z.array(HabitRow).parse(data ?? []);

    return Response.json({ habits });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
