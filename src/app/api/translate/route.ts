import { translateSchema } from "@/lib/validation";
import { clientIp, error, json, parseBody } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { LIMITS, checkRateLimit } from "@/lib/rateLimit";
import { TranslatorError, translate } from "@/lib/translator";
import type { LangCode } from "@/lib/languages";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const allowed = user
    ? await checkRateLimit(`tr:u:${user.id}`, LIMITS.translateUser)
    : await checkRateLimit(`tr:ip:${clientIp(req)}`, LIMITS.translateGuest);
  if (!allowed) return error("Bạn dịch quá nhanh, đợi một chút rồi thử lại", 429);

  const parsed = await parseBody(req, translateSchema);
  if ("response" in parsed) return parsed.response;
  const { text, source, target } = parsed.data as { text: string; source: LangCode; target: LangCode };
  try {
    return json({ translation: await translate({ text, source, target }) });
  } catch (err) {
    if (err instanceof TranslatorError) return error(err.message, err.status);
    throw err;
  }
}
