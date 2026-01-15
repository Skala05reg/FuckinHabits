import { NextResponse } from "next/server";
import { getTelegramAuthOrThrow } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // In Next.js 15 params is async
) {
    try {
        const { telegramId, firstName } = await getTelegramAuthOrThrow(request);
        const user = await ensureUser({ telegramId, firstName });
        const { id } = await params;

        const body = await request.json();
        const { name, date } = body;

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
            .select()
            .single();

        if (error) {
            console.error("Error updating birthday:", error);
            return NextResponse.json({ error: "Failed to update birthday" }, { status: 500 });
        }

        return NextResponse.json({ birthday: updated });
    } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error("API Error", error);
        return NextResponse.json({ error: error.message }, { status: 401 });
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
        const error = e instanceof Error ? e : new Error(String(e));
        console.error("API Error", error);
        return NextResponse.json({ error: error.message }, { status: 401 });
    }
}
