import type { SupabaseClient } from "@supabase/supabase-js";

export type TrackedBotMessage = {
  id: string;
  message_id: number;
};

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown; message?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  const message = typeof maybe.message === "string" ? maybe.message : "";
  return code === "42P01" || (message.includes("bot_messages") && message.includes("does not exist"));
}

export async function listTrackedBotMessages(
  supabase: SupabaseClient,
  params: {
    userId: string;
    messageKind: string;
    limit: number;
  },
): Promise<TrackedBotMessage[]> {
  const { userId, messageKind, limit } = params;
  const { data, error } = await supabase
    .from("bot_messages")
    .select("id,message_id")
    .eq("user_id", userId)
    .eq("message_kind", messageKind)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return (data ?? []) as TrackedBotMessage[];
}

export async function deleteTrackedBotMessagesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from("bot_messages").delete().in("id", ids);
  if (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}

export async function trackBotMessage(
  supabase: SupabaseClient,
  params: {
    userId: string;
    messageKind: string;
    messageId: number;
  },
): Promise<void> {
  const { userId, messageKind, messageId } = params;
  const { error } = await supabase.from("bot_messages").insert({
    user_id: userId,
    message_kind: messageKind,
    message_id: messageId,
  });
  if (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}
