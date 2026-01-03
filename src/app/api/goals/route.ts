import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getLogicalDate } from "@/lib/logical-date";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2500).optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const GoalRow = z.object({
  id: z.string(),
  year: z.number(),
  title: z.string(),
  is_active: z.boolean(),
  position: z.number(),
});

const CreateBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  year: z.number().int().min(1970).max(2500).optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const supabaseAdmin = getSupabaseAdmin();

    const url = new URL(request.url);
    const { year, includeInactive } = QuerySchema.parse({
      year: url.searchParams.get("year") ?? undefined,
      includeInactive: url.searchParams.get("includeInactive") ?? undefined,
    });

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const logicalToday = getLogicalDate(new Date(), tzOffsetMinutes);
    const currentYear = Number(logicalToday.slice(0, 4));
    const y = year ?? currentYear;

    let q = supabaseAdmin
      .from("year_goals")
      .select("id,year,title,is_active,position")
      .eq("user_id", user.id)
      .eq("year", y)
      .order("position", { ascending: true });

    if (!includeInactive) {
      q = q.eq("is_active", true);
    }

    const { data, error } = await q;
    if (error) throw error;

    const goals = z.array(GoalRow).parse(data ?? []);

    return Response.json({ year: y, goals });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const body = CreateBodySchema.parse(await request.json());

    const supabaseAdmin = getSupabaseAdmin();

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const logicalToday = getLogicalDate(new Date(), tzOffsetMinutes);
    const currentYear = Number(logicalToday.slice(0, 4));
    const y = body.year ?? currentYear;

    const { data: maxPosRow, error: maxPosError } = await supabaseAdmin
      .from("year_goals")
      .select("position")
      .eq("user_id", user.id)
      .eq("year", y)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxPosError) throw maxPosError;

    const position = (maxPosRow?.position ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from("year_goals")
      .insert({ user_id: user.id, year: y, title: body.title, is_active: true, position })
      .select("id,year,title,is_active,position")
      .single();

    if (error) throw error;

    return Response.json({ ok: true, goal: GoalRow.parse(data) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
