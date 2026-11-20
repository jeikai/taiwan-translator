import { registerSchema } from "@/lib/validation";
import { clientIp, error, json, parseBody } from "@/lib/http";
import { getStore } from "@/lib/store";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { LIMITS, checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  if (!(await checkRateLimit(`auth:${clientIp(req)}`, LIMITS.auth))) return error("Thử lại sau ít phút", 429);
  const parsed = await parseBody(req, registerSchema);
  if ("response" in parsed) return parsed.response;
  const { email, password, name } = parsed.data;
  const user = await getStore().createUser({ email, name, passwordHash: await hashPassword(password) });
  if (!user) return error("Email này đã được đăng ký", 409);
  await setSessionCookie(user.id);
  return json({ user: { id: user.id, email: user.email, name: user.name } }, 201);
}
