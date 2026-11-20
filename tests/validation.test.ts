import { describe, expect, it } from "vitest";
import { addMessageSchema, registerSchema, translateSchema } from "@/lib/validation";

describe("validation", () => {
  it("normalises email and requires 8-char passwords", () => {
    expect(registerSchema.parse({ email: " A@B.com ", password: "12345678", name: "Phúc" }).email).toBe("a@b.com");
    expect(registerSchema.safeParse({ email: "a@b.com", password: "short", name: "x" }).success).toBe(false);
  });

  it("rejects same source and target, unknown languages and long text", () => {
    expect(translateSchema.safeParse({ text: "你好", source: "zh-TW", target: "vi" }).success).toBe(true);
    expect(translateSchema.safeParse({ text: "你好", source: "vi", target: "vi" }).success).toBe(false);
    expect(translateSchema.safeParse({ text: "你好", source: "ja", target: "vi" }).success).toBe(false);
    expect(translateSchema.safeParse({ text: "a".repeat(1001), source: "en", target: "vi" }).success).toBe(false);
    expect(translateSchema.safeParse({ text: "   ", source: "en", target: "vi" }).success).toBe(false);
  });

  it("checks message speaker", () => {
    const base = { sourceLang: "vi", targetLang: "zh-TW", sourceText: "Xin chào", translatedText: "你好" };
    expect(addMessageSchema.safeParse({ ...base, speaker: "A" }).success).toBe(true);
    expect(addMessageSchema.safeParse({ ...base, speaker: "C" }).success).toBe(false);
  });
});
