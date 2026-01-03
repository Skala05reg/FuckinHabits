import { z } from "zod";

import { getTelegramAuthOrThrow, getTzOffsetMinutes } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    isActive: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => v.title !== undefined || v.isActive !== undefined || v.position !== undefined, {
    message: "No fields to update",
  });

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const { id } = await ctx.params;

    const body = PatchBodySchema.parse(await request.json());

    const supabaseAdmin = getSupabaseAdmin();

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("year_goals")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (exErr) throw exErr;
    if (!existing) throw new Error("Goal not found");

    const payload: Record<string, unknown> = {};
    if (body.title !== undefined) payload.title = body.title;
    if (body.isActive !== undefined) payload.is_active = body.isActive;
    if (body.position !== undefined) payload.position = body.position;

    const { data, error } = await supabaseAdmin
      .from("year_goals")
      .update(payload)
      .eq("id", id)
      .select("id,year,title,is_active,position")
      .single();

    if (error) throw error;

    return Response.json({ ok: true, goal: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const tzOffsetMinutes = getTzOffsetMinutes(request);
    const { id } = await ctx.params;

    const supabaseAdmin = getSupabaseAdmin();

    const user = await ensureUser({
      telegramId: auth.telegramId,
      firstName: auth.firstName,
      tzOffsetMinutes,
    });

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("year_goals")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (exErr) throw exErr;
    if (!existing) throw new Error("Goal not found");

    const { error } = await supabaseAdmin.from("year_goals").update({ is_active: false }).eq("id", id);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
