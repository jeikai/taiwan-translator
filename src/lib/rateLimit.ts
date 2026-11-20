import { getStore } from "./store";

export const LIMITS = {
  translateGuest: { max: 30, windowMs: 60_000 },
  translateUser: { max: 120, windowMs: 60_000 },
  auth: { max: 10, windowMs: 10 * 60_000 },
} as const;

/** Returns true when the request is allowed. */
export async function checkRateLimit(key: string, limit: { max: number; windowMs: number }) {
  const count = await getStore().hitRateLimit(key, limit.windowMs);
  return count <= limit.max;
}
