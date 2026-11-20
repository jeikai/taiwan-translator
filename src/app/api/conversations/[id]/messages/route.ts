import { addMessageSchema } from "@/lib/validation";
import { error, json, parseBody } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { LangCode } from "@/lib/languages";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return error("Cần đăng nhập", 401);
  const { id } = await params;
  const store = getStore();
  const conversation = await store.getConversation(id, user.id);
  if (!conversation) return error("Không tìm thấy hội thoại", 404);
  const parsed = await parseBody(req, addMessageSchema);
  if ("response" in parsed) return parsed.response;
  const m = parsed.data;
  const pair = [conversation.langA, conversation.langB];
  if (!pair.includes(m.sourceLang as LangCode) || !pair.includes(m.targetLang as LangCode) || m.sourceLang === m.targetLang) {
    return error("Ngôn ngữ không khớp với hội thoại", 400);
  }
  const message = await store.addMessage({
    conversationId: id,
    userId: user.id,
    speaker: m.speaker,
    sourceLang: m.sourceLang as LangCode,
    targetLang: m.targetLang as LangCode,
    sourceText: m.sourceText,
    translatedText: m.translatedText,
  });
  return json({ message }, 201);
}
