import type { LangCode } from "./languages";

export class TranslatorError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export interface TranslateInput {
  text: string;
  source: LangCode;
  target: LangCode;
}

export function mockTranslate({ text, target }: TranslateInput) {
  return `[${target}] ${text}`;
}

export async function translate(input: TranslateInput, fetchImpl: typeof fetch = fetch): Promise<string> {
  const provider = process.env.TRANSLATE_PROVIDER ?? "remote";
  if (provider === "mock") return mockTranslate(input);

  const base = process.env.TRANSLATE_API_URL;
  const key = process.env.TRANSLATE_API_KEY;
  if (!base || !key) throw new TranslatorError("Máy chủ dịch chưa được cấu hình", 503);

  let res: Response;
  try {
    res = await fetchImpl(`${base.replace(/\/$/, "")}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": key },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TranslatorError("Không kết nối được máy chủ dịch", 503);
  }
  if (!res.ok) throw new TranslatorError(`Máy chủ dịch lỗi (${res.status})`, res.status === 429 ? 429 : 502);
  const data = (await res.json().catch(() => null)) as { translation?: unknown } | null;
  if (!data || typeof data.translation !== "string") throw new TranslatorError("Máy chủ dịch trả kết quả lạ");
  return data.translation;
}
