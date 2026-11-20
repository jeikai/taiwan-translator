import type { Store } from "./types";
import { MemoryStore } from "./memory";
import { MongoStore } from "./mongo";

const g = globalThis as unknown as { __store?: Store };

export function getStore(): Store {
  if (!g.__store) {
    const kind = process.env.DATA_STORE ?? "mongo";
    if (kind === "memory" && process.env.VERCEL_ENV === "production") {
      throw new Error("DATA_STORE=memory is not allowed in production");
    }
    g.__store = kind === "memory" ? new MemoryStore() : new MongoStore();
  }
  return g.__store;
}

/** For tests. */
export function setStore(store: Store) {
  g.__store = store;
}
