import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    efficiency: z.number().int().min(1).max(5).optional(),
    social: z.number().int().min(1).max(5).optional(),
    journalText: z.string().max(10_000).optional(),
  })
  .refine(
    (v: { efficiency?: number; social?: number; journalText?: string }) =>
      v.efficiency !== undefined || v.social !== undefined || v.journalText !== undefined,
    {
      message: "No fields to update",
    },
  );

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

    const payload: Record<string, unknown> = {
      user_id: user.id,
      date,
    };

    if (body.efficiency !== undefined) payload.rating_efficiency = body.efficiency;
    if (body.social !== undefined) payload.rating_social = body.social;
    if (body.journalText !== undefined) payload.journal_text = body.journalText;

    const { error } = await supabaseAdmin.from("daily_logs").upsert(payload, {
      onConflict: "user_id,date",
    });

    if (error) throw error;

    return Response.json({ ok: true, date });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
