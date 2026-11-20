import { afterEach, describe, expect, it, vi } from "vitest";
import { TranslatorError, translate } from "@/lib/translator";

const input = { text: "你好", source: "zh-TW" as const, target: "vi" as const };

afterEach(() => vi.unstubAllEnvs());

describe("translate", () => {
  it("mock provider echoes with the target tag", async () => {
    vi.stubEnv("TRANSLATE_PROVIDER", "mock");
    expect(await translate(input)).toBe("[vi] 你好");
  });

  it("calls the remote server with the API key", async () => {
    vi.stubEnv("TRANSLATE_PROVIDER", "remote");
    vi.stubEnv("TRANSLATE_API_URL", "https://mt.example.org/");
    vi.stubEnv("TRANSLATE_API_KEY", "secret");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ translation: "Xin chào" }), { status: 200 }));
    expect(await translate(input, fetchMock as unknown as typeof fetch)).toBe("Xin chào");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://mt.example.org/translate");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("secret");
    expect(JSON.parse(init.body as string)).toEqual(input);
  });

  it("reports a missing configuration as 503", async () => {
    vi.stubEnv("TRANSLATE_PROVIDER", "remote");
    vi.stubEnv("TRANSLATE_API_URL", "");
    await expect(translate(input)).rejects.toMatchObject({ status: 503 });
  });

  it("maps server failures to TranslatorError", async () => {
    vi.stubEnv("TRANSLATE_PROVIDER", "remote");
    vi.stubEnv("TRANSLATE_API_URL", "https://mt.example.org");
    vi.stubEnv("TRANSLATE_API_KEY", "k");
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(translate(input, down as unknown as typeof fetch)).rejects.toBeInstanceOf(TranslatorError);
    const bad = vi.fn(async () => new Response("{}", { status: 200 }));
    await expect(translate(input, bad as unknown as typeof fetch)).rejects.toBeInstanceOf(TranslatorError);
    const busy = vi.fn(async () => new Response("", { status: 429 }));
    await expect(translate(input, busy as unknown as typeof fetch)).rejects.toMatchObject({ status: 429 });
  });
});
