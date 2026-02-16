import { NextResponse } from "next/server";

import { requireCronAuth } from "@/lib/cron-auth";
import { ensureUser } from "@/lib/db/users";
import { sendDailyDigest } from "@/lib/features/digest";

export const dynamic = "force-dynamic";

async function runDailyDigest(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const telegramIdRaw = process.env.TELEGRAM_USER_ID;
  if (!telegramIdRaw) {
    return new NextResponse("TELEGRAM_USER_ID not set", { status: 500 });
  }

  const telegramId = Number(telegramIdRaw);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
    return new NextResponse("Invalid TELEGRAM_USER_ID", { status: 500 });
  }

  try {
    const user = await ensureUser({ telegramId });
    const sent = await sendDailyDigest({
      userId: user.id,
      telegramId: user.telegram_id,
      tzOffsetMinutes: user.tz_offset_minutes ?? 0,
    });

    return NextResponse.json({ sent });
  } catch (error) {
    console.error("Manual daily digest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runDailyDigest(request);
}

export async function POST(request: Request) {
  return runDailyDigest(request);
}
