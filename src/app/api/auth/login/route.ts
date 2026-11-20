import { loginSchema } from "@/lib/validation";
import { clientIp, error, json, parseBody } from "@/lib/http";
import { getStore } from "@/lib/store";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { LIMITS, checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  if (!(await checkRateLimit(`auth:${clientIp(req)}`, LIMITS.auth))) return error("Thử lại sau ít phút", 429);
  const parsed = await parseBody(req, loginSchema);
  if ("response" in parsed) return parsed.response;
  const user = await getStore().findUserByEmail(parsed.data.email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return error("Sai email hoặc mật khẩu", 401);
  }
  await setSessionCookie(user.id);
  return json({ user: { id: user.id, email: user.email, name: user.name } });
}
