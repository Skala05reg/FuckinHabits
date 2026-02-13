import { z } from "zod";

import { APP_CONFIG } from "@/config/app";
import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  cursor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(APP_CONFIG.notesMaxPageSize).optional(),
});

const NoteRow = z.object({
  date: z.string(),
  journal_text: z.string().nullable(),
  rating_efficiency: z.number().nullable().optional(),
  rating_social: z.number().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const url = new URL(request.url);
    const { cursor, limit } = QuerySchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const pageSize = limit ?? APP_CONFIG.notesDefaultPageSize;

    const supabaseAdmin = getSupabaseAdmin();

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const today = getLogicalDate(new Date(), tzOffsetMinutes);

    let q = supabaseAdmin
      .from("daily_logs")
      .select("date,journal_text,rating_efficiency,rating_social")
      .eq("user_id", user.id)
      .lt("date", today)
      .not("journal_text", "is", null)
      .order("date", { ascending: false })
      .limit(pageSize + 1);

    if (cursor) {
      q = q.lt("date", cursor);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = z.array(NoteRow).parse(data ?? []);

    const filtered = rows.filter((r) => (r.journal_text ?? "").trim().length > 0);

    const hasMore = filtered.length > pageSize;
    const items = filtered.slice(0, pageSize).map((r) => ({
      date: r.date,
      journalText: r.journal_text ?? "",
      ratingEfficiency: r.rating_efficiency ?? null,
      ratingSocial: r.rating_social ?? null,
    }));

    const nextCursor = hasMore ? items[items.length - 1]?.date ?? null : null;

    return Response.json({ items, nextCursor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
