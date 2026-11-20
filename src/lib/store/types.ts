import type { LangCode } from "../languages";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}

export interface ConversationRecord {
  id: string;
  userId: string;
  title: string;
  langA: LangCode;
  langB: LangCode;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  userId: string;
  speaker: "A" | "B";
  sourceLang: LangCode;
  targetLang: LangCode;
  sourceText: string;
  translatedText: string;
  createdAt: Date;
}

export type NewMessage = Omit<MessageRecord, "id" | "createdAt">;

export interface Store {
  createUser(data: { email: string; name: string; passwordHash: string }): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;

  listConversations(userId: string, query?: string): Promise<ConversationRecord[]>;
  createConversation(data: { userId: string; title: string; langA: LangCode; langB: LangCode }): Promise<ConversationRecord>;
  getConversation(id: string, userId: string): Promise<ConversationRecord | null>;
  renameConversation(id: string, userId: string, title: string): Promise<ConversationRecord | null>;
  deleteConversation(id: string, userId: string): Promise<boolean>;

  listMessages(conversationId: string): Promise<MessageRecord[]>;
  addMessage(data: NewMessage): Promise<MessageRecord>;

  /** Increments the counter for `key` in the current window and returns the new count. */
  hitRateLimit(key: string, windowMs: number): Promise<number>;
}
