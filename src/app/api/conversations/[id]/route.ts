import { renameConversationSchema } from "@/lib/validation";
import { error, json, parseBody } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return error("Cần đăng nhập", 401);
  const { id } = await params;
  const store = getStore();
  const conversation = await store.getConversation(id, user.id);
  if (!conversation) return error("Không tìm thấy hội thoại", 404);
  return json({ conversation, messages: await store.listMessages(id) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return error("Cần đăng nhập", 401);
  const parsed = await parseBody(req, renameConversationSchema);
  if ("response" in parsed) return parsed.response;
  const { id } = await params;
  const conversation = await getStore().renameConversation(id, user.id, parsed.data.title);
  if (!conversation) return error("Không tìm thấy hội thoại", 404);
  return json({ conversation });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return error("Cần đăng nhập", 401);
  const { id } = await params;
  if (!(await getStore().deleteConversation(id, user.id))) return error("Không tìm thấy hội thoại", 404);
  return json({ ok: true });
}
