import { randomBytes } from "node:crypto";
import type { ConversationRecord, MessageRecord, Store, UserRecord } from "./types";

const newId = () => randomBytes(12).toString("hex");

export class MemoryStore implements Store {
  users = new Map<string, UserRecord>();
  conversations = new Map<string, ConversationRecord>();
  messages: MessageRecord[] = [];
  limits = new Map<string, { windowStart: number; count: number }>();

  async createUser(data: { email: string; name: string; passwordHash: string }) {
    if (await this.findUserByEmail(data.email)) return null;
    const user: UserRecord = { id: newId(), createdAt: new Date(), ...data };
    this.users.set(user.id, user);
    return user;
  }
  async findUserByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }
  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async listConversations(userId: string, query?: string) {
    const q = query?.toLowerCase();
    return [...this.conversations.values()]
      .filter((c) => c.userId === userId)
      .filter(
        (c) =>
          !q ||
          c.title.toLowerCase().includes(q) ||
          this.messages.some(
            (m) =>
              m.conversationId === c.id &&
              (m.sourceText.toLowerCase().includes(q) || m.translatedText.toLowerCase().includes(q)),
          ),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  async createConversation(data: Pick<ConversationRecord, "userId" | "title" | "langA" | "langB">) {
    const now = new Date();
    const conv: ConversationRecord = { id: newId(), messageCount: 0, createdAt: now, updatedAt: now, ...data };
    this.conversations.set(conv.id, conv);
    return conv;
  }
  async getConversation(id: string, userId: string) {
    const c = this.conversations.get(id);
    return c && c.userId === userId ? c : null;
  }
  async renameConversation(id: string, userId: string, title: string) {
    const c = await this.getConversation(id, userId);
    if (!c) return null;
    c.title = title;
    c.updatedAt = new Date();
    return c;
  }
  async deleteConversation(id: string, userId: string) {
    const c = await this.getConversation(id, userId);
    if (!c) return false;
    this.conversations.delete(id);
    this.messages = this.messages.filter((m) => m.conversationId !== id);
    return true;
  }

  async listMessages(conversationId: string) {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async addMessage(data: Omit<MessageRecord, "id" | "createdAt">) {
    const msg: MessageRecord = { id: newId(), createdAt: new Date(), ...data };
    this.messages.push(msg);
    const c = this.conversations.get(data.conversationId);
    if (c) {
      c.messageCount += 1;
      c.updatedAt = msg.createdAt;
    }
    return msg;
  }

  async hitRateLimit(key: string, windowMs: number) {
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    const cur = this.limits.get(key);
    if (!cur || cur.windowStart !== windowStart) {
      this.limits.set(key, { windowStart, count: 1 });
      return 1;
    }
    cur.count += 1;
    return cur.count;
  }
}
