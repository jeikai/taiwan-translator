"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { LANGUAGES, type LangCode } from "@/lib/languages";

interface Conv {
  id: string;
  title: string;
  langA: LangCode;
  langB: LangCode;
  messageCount: number;
  updatedAt: string;
}

export function HistoryList() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Conv[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ conversations: Conv[] }>(`/api/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`)
        .then((d) => setItems(d.conversations))
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function remove(id: string) {
    if (!window.confirm("Xoá hội thoại này?")) return;
    await api(`/api/conversations/${id}`, { method: "DELETE" });
    setItems((prev) => prev?.filter((c) => c.id !== id) ?? null);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
      <h1 className="text-xl font-bold">Lịch sử hội thoại</h1>
      <input className="input" placeholder="Tìm theo nội dung…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm kiếm" />
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {items === null && !error && <p className="muted">Đang tải…</p>}
      {items?.length === 0 && <p className="muted">Chưa có hội thoại nào.</p>}
      <ul className="flex flex-col gap-2">
        {items?.map((c) => (
          <li key={c.id} className="panel flex items-center gap-3 rounded-lg p-3">
            <Link href={`/history/${c.id}`} className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.title}</p>
              <p className="muted text-xs">
                {LANGUAGES[c.langA]?.short} ⇄ {LANGUAGES[c.langB]?.short} · {c.messageCount} câu ·{" "}
                {new Date(c.updatedAt).toLocaleString("vi-VN")}
              </p>
            </Link>
            <button className="btn text-sm" onClick={() => remove(c.id)} aria-label={`Xoá ${c.title}`}>
              Xoá
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
