import { getSupabaseAdmin } from "@/lib/supabase";

export type DbUser = {
  id: string;
  telegram_id: number;
  first_name: string | null;
  tz_offset_minutes: number;
};

export async function ensureUser(params: {
  telegramId: number;
  firstName?: string;
  tzOffsetMinutes?: number;
}): Promise<DbUser> {
  const { telegramId, firstName, tzOffsetMinutes } = params;
  const supabaseAdmin = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("users")
    .select("id, telegram_id, first_name, tz_offset_minutes")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("users")
      .insert({
        telegram_id: telegramId,
        first_name: firstName ?? null,
        tz_offset_minutes: tzOffsetMinutes ?? 0,
      })
      .select("id, telegram_id, first_name, tz_offset_minutes")
      .single();

    if (createError) throw createError;
    return created;
  }

  const desiredFirstName = firstName ?? existing.first_name ?? null;
  const desiredTz = tzOffsetMinutes ?? existing.tz_offset_minutes;

  if (existing.first_name !== desiredFirstName || existing.tz_offset_minutes !== desiredTz) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        first_name: desiredFirstName,
        tz_offset_minutes: desiredTz,
      })
      .eq("id", existing.id)
      .select("id, telegram_id, first_name, tz_offset_minutes")
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  return existing;
}
