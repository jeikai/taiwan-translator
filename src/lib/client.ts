"use client";

import type { LangCode } from "./languages";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Lỗi ${res.status}`);
  return data as T;
}

export async function translateText(text: string, source: LangCode, target: LangCode, signal?: AbortSignal) {
  const { translation } = await api<{ translation: string }>("/api/translate", {
    method: "POST",
    body: JSON.stringify({ text, source, target }),
    signal,
  });
  return translation;
}
