import { getBot } from "@/lib/bot";
import { sendTaskListMessage } from "@/lib/features/task-lists";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function sendDailyDigest(params: {
  userId: string;
  telegramId: number;
  tzOffsetMinutes: number;
}): Promise<boolean> {
  const { userId, telegramId, tzOffsetMinutes } = params;
  try {
    const bot = getBot();
    await bot.init();
    const supabase = getSupabaseAdmin();
    await sendTaskListMessage({
      bot,
      supabase,
      userId,
      telegramId,
      tzOffsetMinutes,
    });
    return true;
  } catch (error) {
    console.error("Error sending daily digest:", error);
    return false;
  }
}
