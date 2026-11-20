import { createConversationSchema } from "@/lib/validation";
import { error, json, parseBody } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { LangCode } from "@/lib/languages";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return error("Cần đăng nhập", 401);
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) || undefined;
  return json({ conversations: await getStore().listConversations(user.id, q) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return error("Cần đăng nhập", 401);
  const parsed = await parseBody(req, createConversationSchema);
  if ("response" in parsed) return parsed.response;
  const { title, langA, langB } = parsed.data as { title?: string; langA: LangCode; langB: LangCode };
  const now = new Date();
  const conversation = await getStore().createConversation({
    userId: user.id,
    title: title || `Hội thoại ${now.toISOString().slice(0, 16).replace("T", " ")}`,
    langA,
    langB,
  });
  return json({ conversation }, 201);
}
