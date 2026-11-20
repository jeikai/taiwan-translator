import { beforeEach, describe, expect, it, vi } from "vitest";
import { jar } from "./setup-cookies";
import { MemoryStore } from "@/lib/store/memory";
import { setStore } from "@/lib/store";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as translateRoute } from "@/app/api/translate/route";
import { GET as listConvs, POST as createConv } from "@/app/api/conversations/route";
import { DELETE as deleteConv, GET as getConv, PATCH as patchConv } from "@/app/api/conversations/[id]/route";
import { POST as addMsg } from "@/app/api/conversations/[id]/messages/route";

vi.stubEnv("AUTH_SECRET", "test-secret-test-secret");
vi.stubEnv("TRANSLATE_PROVIDER", "mock");

let ipCounter = 0;
const req = (body?: unknown, url = "http://test/api", method = "POST") =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ipCounter}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function signUp(email: string) {
  jar.clear();
  const res = await register(req({ email, password: "password123", name: "Tester" }));
  expect(res.status).toBe(201);
}

let store: MemoryStore;
beforeEach(() => {
  store = new MemoryStore();
  setStore(store);
  jar.clear();
  ipCounter++;
});

describe("auth", () => {
  it("registers, rejects duplicates, and logs in", async () => {
    await signUp("a@example.com");
    expect(jar.get("tt_session")).toBeTruthy();
    const dup = await register(req({ email: "a@example.com", password: "password123", name: "X" }));
    expect(dup.status).toBe(409);
    jar.clear();
    expect((await login(req({ email: "a@example.com", password: "wrong-pass" }))).status).toBe(401);
    expect((await login(req({ email: "A@example.com", password: "password123" }))).status).toBe(200);
    expect(store.users.size).toBe(1);
    expect([...store.users.values()][0].passwordHash).not.toContain("password123");
  });

  it("rate limits auth attempts per IP", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await login(req({ email: "x@example.com", password: "p" }))).status;
    expect(last).toBe(429);
  });
});

describe("translate", () => {
  it("works for guests and validates input", async () => {
    const res = await translateRoute(req({ text: "你好", source: "zh-TW", target: "vi" }));
    expect(await res.json()).toEqual({ translation: "[vi] 你好" });
    expect((await translateRoute(req({ text: "", source: "zh-TW", target: "vi" }))).status).toBe(400);
  });

  it("limits guests to 30 per minute", async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await translateRoute(req({ text: "hi", source: "en", target: "vi" }))).status;
    expect(last).toBe(429);
  });
});

describe("conversations", () => {
  it("requires login", async () => {
    expect((await listConvs(req(undefined, "http://test/api/conversations", "GET"))).status).toBe(401);
  });

  it("creates, stores messages, searches, renames and deletes", async () => {
    await signUp("b@example.com");
    const created = await createConv(req({ langA: "vi", langB: "zh-TW" }));
    expect(created.status).toBe(201);
    const { conversation } = await created.json();

    const msg = { speaker: "B", sourceLang: "zh-TW", targetLang: "vi", sourceText: "捷運站在哪裡", translatedText: "Ga tàu điện ở đâu" };
    expect((await addMsg(req(msg), ctx(conversation.id))).status).toBe(201);
    // Language outside the conversation's pair is refused.
    expect((await addMsg(req({ ...msg, targetLang: "en" }), ctx(conversation.id))).status).toBe(400);

    const detail = await (await getConv(req(undefined, "http://t", "GET"), ctx(conversation.id))).json();
    expect(detail.messages).toHaveLength(1);
    expect(detail.conversation.messageCount).toBe(1);

    const found = await (await listConvs(req(undefined, "http://test/api/conversations?q=tàu", "GET"))).json();
    expect(found.conversations).toHaveLength(1);
    const none = await (await listConvs(req(undefined, "http://test/api/conversations?q=zzz", "GET"))).json();
    expect(none.conversations).toHaveLength(0);

    const renamed = await (await patchConv(req({ title: "Hỏi đường" }, "http://t", "PATCH"), ctx(conversation.id))).json();
    expect(renamed.conversation.title).toBe("Hỏi đường");

    expect((await deleteConv(req(undefined, "http://t", "DELETE"), ctx(conversation.id))).status).toBe(200);
    expect(store.messages).toHaveLength(0);
  });

  it("hides other users' conversations", async () => {
    await signUp("owner@example.com");
    const { conversation } = await (await createConv(req({ langA: "en", langB: "zh-TW" }))).json();
    await signUp("intruder@example.com");
    expect((await getConv(req(undefined, "http://t", "GET"), ctx(conversation.id))).status).toBe(404);
    expect((await deleteConv(req(undefined, "http://t", "DELETE"), ctx(conversation.id))).status).toBe(404);
    const msg = { speaker: "A", sourceLang: "en", targetLang: "zh-TW", sourceText: "hi", translatedText: "嗨" };
    expect((await addMsg(req(msg), ctx(conversation.id))).status).toBe(404);
  });
});
