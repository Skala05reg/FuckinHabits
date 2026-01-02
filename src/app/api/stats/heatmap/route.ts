import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Row = z.object({
  date: z.string(),
  rating_efficiency: z.number().nullable(),
  rating_social: z.number().nullable(),
});

export async function GET(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const supabaseAdmin = getSupabaseAdmin();

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 365);
    const fromDate = from.toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from("daily_logs")
      .select("date,rating_efficiency,rating_social")
      .eq("user_id", user.id)
      .gte("date", fromDate)
      .order("date", { ascending: true });

    if (error) throw error;

    const rows = z.array(Row).parse(data ?? []);

    const points = rows.map((r) => {
      const e = r.rating_efficiency;
      const s = r.rating_social;
      const value = e !== null && s !== null ? Math.round((e + s) / 2) : (e ?? s ?? 0);
      return { date: r.date, value };
    });

    return Response.json({ fromDate, points });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
