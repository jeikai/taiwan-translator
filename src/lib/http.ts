import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { response: error("Dữ liệu gửi lên không hợp lệ", 400) };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return { response: error(result.error.issues[0]?.message ?? "Dữ liệu không hợp lệ", 400) };
  }
  return { data: result.data };
}

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
