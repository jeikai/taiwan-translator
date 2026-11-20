"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { speak } from "@/lib/speech";
import type { LangCode } from "@/lib/languages";

interface Msg {
  id: string;
  speaker: "A" | "B";
  sourceLang: LangCode;
  targetLang: LangCode;
  sourceText: string;
  translatedText: string;
  createdAt: string;
}

export function HistoryDetail({ id }: { id: string }) {
  const [title, setTitle] = useState("");
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ conversation: { title: string }; messages: Msg[] }>(`/api/conversations/${id}`)
      .then((d) => {
        setTitle(d.conversation.title);
        setMessages(d.messages);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    await api(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (error) return <p className="p-4 text-red-600">{error}</p>;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
      <Link href="/history" className="muted text-sm">
        ← Lịch sử
      </Link>
      <form onSubmit={rename} className="flex gap-2">
        <input className="input font-semibold" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Tên hội thoại" />
        <button className="btn">{saved ? "Đã lưu" : "Đổi tên"}</button>
      </form>
      {messages === null && <p className="muted">Đang tải…</p>}
      <ol className="flex flex-col gap-3">
        {messages?.map((m) => (
          <li key={m.id} className={`flex flex-col gap-1 ${m.speaker === "A" ? "items-end" : "items-start"}`}>
            <p className="bubble-own rounded-xl px-3 py-2">{m.sourceText}</p>
            <button className="bubble-tr rounded-xl px-3 py-2 text-left" onClick={() => speak(m.translatedText, m.targetLang)} title="Nghe">
              {m.translatedText}
            </button>
            <span className="muted text-xs">{new Date(m.createdAt).toLocaleTimeString("vi-VN")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
