import { z } from "zod";
import { getTelegramAuthOrThrow } from "@/lib/api-auth";
import { ensureUser } from "@/lib/db/users";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  digestTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), // HH:mm format
});

export async function POST(request: Request) {
  try {
    const auth = await getTelegramAuthOrThrow(request);
    const json = await request.json();
    const { digestTime } = BodySchema.parse(json);

    const supabaseAdmin = getSupabaseAdmin();
    const user = await ensureUser({ telegramId: auth.telegramId });

    const { error } = await supabaseAdmin
      .from("users")
      .update({ digest_time: digestTime })
      .eq("id", user.id);

    if (error) throw error;

    return Response.json({ success: true, digestTime });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 400 });
  }
}
