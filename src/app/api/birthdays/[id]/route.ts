import { z } from "zod";
import { NextResponse } from "next/server";
import { getTelegramAuthOrThrow } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateBirthdaySchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // In Next.js 15 params is async
) {
    try {
        const { telegramId, firstName } = await getTelegramAuthOrThrow(request);
        const user = await ensureUser({ telegramId, firstName });
        const { id } = await params;

        const { name, date } = UpdateBirthdaySchema.parse(await request.json());

        const supabase = getSupabaseAdmin();

        // Verify ownership
        const { data: existing, error: fetchError } = await supabase
            .from("birthdays")
            .select("id, user_id")
            .eq("id", id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (existing.user_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { data: updated, error } = await supabase
            .from("birthdays")
            .update({
                name,
                date,
            })
            .eq("id", id)
            .select("id,name,date,created_at,user_id")
            .single();

        if (error) {
            console.error("Error updating birthday:", error);
            return NextResponse.json({ error: "Failed to update birthday" }, { status: 500 });
        }

        return NextResponse.json({ birthday: updated });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("API Error", e);
        const status = msg.includes("initData") || msg.includes("telegram") ? 401 : 400;
        return NextResponse.json({ error: msg }, { status });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { telegramId, firstName } = await getTelegramAuthOrThrow(request);
        const user = await ensureUser({ telegramId, firstName });
        const { id } = await params;

        const supabase = getSupabaseAdmin();

        // Verify ownership
        const { data: existing, error: fetchError } = await supabase
            .from("birthdays")
            .select("id, user_id")
            .eq("id", id)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (existing.user_id !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { error } = await supabase
            .from("birthdays")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Error deleting birthday:", error);
            return NextResponse.json({ error: "Failed to delete birthday" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("API Error", e);
        const status = msg.includes("initData") || msg.includes("telegram") ? 401 : 400;
        return NextResponse.json({ error: msg }, { status });
    }
}
