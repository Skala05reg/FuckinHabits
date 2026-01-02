import { getBot } from "@/lib/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const update = await request.json();
  const bot = getBot();
  await bot.handleUpdate(update);
  return new Response("ok");
}
