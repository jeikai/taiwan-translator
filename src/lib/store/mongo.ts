import mongoose, { Schema, type Model } from "mongoose";
import type { ConversationRecord, MessageRecord, NewMessage, Store, UserRecord } from "./types";
import type { LangCode } from "../languages";

const userSchema = new Schema<any>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const conversationSchema = new Schema<any>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    title: { type: String, required: true },
    langA: { type: String, required: true },
    langB: { type: String, required: true },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
conversationSchema.index({ userId: 1, updatedAt: -1 });

const messageSchema = new Schema<any>(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true, ref: "Conversation" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    speaker: { type: String, enum: ["A", "B"], required: true },
    sourceLang: { type: String, required: true },
    targetLang: { type: String, required: true },
    sourceText: { type: String, required: true },
    translatedText: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ userId: 1 });

const rateLimitSchema = new Schema<any>({
  key: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
rateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

function model(name: string, schema: Schema<any>): Model<any> {
  return (mongoose.models[name] as Model<any>) ?? mongoose.model<any>(name, schema);
}

const User = model("User", userSchema);
const Conversation = model("Conversation", conversationSchema);
const Message = model("Message", messageSchema);
const RateLimit = model("RateLimit", rateLimitSchema);

// Reuse one connection across hot reloads and serverless invocations.
const g = globalThis as unknown as { __mongoConn?: Promise<typeof mongoose> };
async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  g.__mongoConn ??= mongoose.connect(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 });
  try {
    return await g.__mongoConn;
  } catch (err) {
    g.__mongoConn = undefined;
    throw err;
  }
}

const isId = (id: string) => mongoose.isValidObjectId(id);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toUser = (d: any): UserRecord => ({
  id: String(d._id),
  email: d.email,
  name: d.name,
  passwordHash: d.passwordHash,
  createdAt: d.createdAt,
});
const toConversation = (d: any): ConversationRecord => ({
  id: String(d._id),
  userId: String(d.userId),
  title: d.title,
  langA: d.langA as LangCode,
  langB: d.langB as LangCode,
  messageCount: d.messageCount ?? 0,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});
const toMessage = (d: any): MessageRecord => ({
  id: String(d._id),
  conversationId: String(d.conversationId),
  userId: String(d.userId),
  speaker: d.speaker,
  sourceLang: d.sourceLang,
  targetLang: d.targetLang,
  sourceText: d.sourceText,
  translatedText: d.translatedText,
  createdAt: d.createdAt,
});

export class MongoStore implements Store {
  async createUser(data: { email: string; name: string; passwordHash: string }) {
    await connect();
    try {
      return toUser(await User.create(data));
    } catch (err: any) {
      if (err?.code === 11000) return null; // duplicate email
      throw err;
    }
  }
  async findUserByEmail(email: string) {
    await connect();
    const d = await User.findOne({ email }).lean();
    return d ? toUser(d) : null;
  }
  async findUserById(id: string) {
    if (!isId(id)) return null;
    await connect();
    const d = await User.findById(id).lean();
    return d ? toUser(d) : null;
  }

  async listConversations(userId: string, query?: string) {
    if (!isId(userId)) return [];
    await connect();
    const filter: any = { userId };
    if (query) {
      const rx = new RegExp(escapeRegex(query), "i");
      const ids = await Message.distinct("conversationId", {
        userId,
        $or: [{ sourceText: rx }, { translatedText: rx }],
      });
      filter.$or = [{ title: rx }, { _id: { $in: ids } }];
    }
    const docs = await Conversation.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    return docs.map(toConversation);
  }
  async createConversation(data: { userId: string; title: string; langA: LangCode; langB: LangCode }) {
    await connect();
    return toConversation(await Conversation.create(data));
  }
  async getConversation(id: string, userId: string) {
    if (!isId(id) || !isId(userId)) return null;
    await connect();
    const d = await Conversation.findOne({ _id: id, userId }).lean();
    return d ? toConversation(d) : null;
  }
  async renameConversation(id: string, userId: string, title: string) {
    if (!isId(id) || !isId(userId)) return null;
    await connect();
    const d = await Conversation.findOneAndUpdate({ _id: id, userId }, { title }, { new: true }).lean();
    return d ? toConversation(d) : null;
  }
  async deleteConversation(id: string, userId: string) {
    if (!isId(id) || !isId(userId)) return false;
    await connect();
    const res = await Conversation.deleteOne({ _id: id, userId });
    if (res.deletedCount === 0) return false;
    await Message.deleteMany({ conversationId: id });
    return true;
  }

  async listMessages(conversationId: string) {
    if (!isId(conversationId)) return [];
    await connect();
    const docs = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(2000).lean();
    return docs.map(toMessage);
  }
  async addMessage(data: NewMessage) {
    await connect();
    const doc = await Message.create(data);
    await Conversation.updateOne({ _id: data.conversationId }, { $inc: { messageCount: 1 }, $set: { updatedAt: new Date() } });
    return toMessage(doc);
  }

  async hitRateLimit(key: string, windowMs: number) {
    await connect();
    const start = Math.floor(Date.now() / windowMs) * windowMs;
    const d = await RateLimit.findOneAndUpdate(
      { key, windowStart: new Date(start) },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(start + windowMs * 2) } },
      { upsert: true, new: true },
    ).lean();
    return (d as any).count as number;
  }
}
