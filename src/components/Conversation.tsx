"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LANGUAGES, LANG_CODES, type LangCode } from "@/lib/languages";
import { api, translateText } from "@/lib/client";
import { getRecognitionCtor, listen, speak, type Recognition } from "@/lib/speech";
import type { SessionUser } from "@/lib/auth";

type Speaker = "A" | "B";

interface Line {
  key: string;
  speaker: Speaker;
  sourceLang: LangCode;
  targetLang: LangCode;
  sourceText: string;
  translatedText: string;
}

interface Live {
  speaker: Speaker;
  source: string;
  translated: string;
}

const INTERIM_DELAY = 500;

export function Conversation({ user }: { user: SessionUser | null }) {
  // A = bottom half (you), B = top half (the other person).
  const [langA, setLangA] = useState<LangCode>("vi");
  const [langB, setLangB] = useState<LangCode>("zh-TW");
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState<Live | null>(null);
  const [listening, setListening] = useState<Speaker | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speechOk, setSpeechOk] = useState(true);
  const conversationId = useRef<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const interimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimAbort = useRef<AbortController | null>(null);
  const bottomRefs = { A: useRef<HTMLDivElement>(null), B: useRef<HTMLDivElement>(null) };

  useEffect(() => {
    setSpeechOk(!!getRecognitionCtor());
    try {
      const saved = JSON.parse(localStorage.getItem("tt_langs") ?? "null");
      if (saved && saved.a in LANGUAGES && saved.b in LANGUAGES && saved.a !== saved.b) {
        setLangA(saved.a);
        setLangB(saved.b);
      }
      setAutoSpeak(localStorage.getItem("tt_autospeak") !== "0");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("tt_langs", JSON.stringify({ a: langA, b: langB }));
    } catch {}
  }, [langA, langB]);

  useEffect(() => {
    bottomRefs.A.current?.scrollIntoView({ block: "end" });
    bottomRefs.B.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, live]);

  const langOf = (s: Speaker) => (s === "A" ? langA : langB);
  const otherOf = (s: Speaker) => (s === "A" ? langB : langA);

  function changeLang(s: Speaker, value: LangCode) {
    const other = s === "A" ? langB : langA;
    if (value === other) {
      // Picking the other side's language swaps the pair.
      setLangA(s === "A" ? value : langA === value ? langB : langA);
      setLangB(s === "B" ? value : langB === value ? langA : langB);
    } else if (s === "A") setLangA(value);
    else setLangB(value);
    resetConversation();
  }

  function swap() {
    setLangA(langB);
    setLangB(langA);
    resetConversation();
  }

  function resetConversation() {
    conversationId.current = null;
    setLines([]);
  }

  async function save(line: Line) {
    if (!user) return;
    try {
      if (!conversationId.current) {
        const { conversation } = await api<{ conversation: { id: string } }>("/api/conversations", {
          method: "POST",
          body: JSON.stringify({ langA, langB, title: line.sourceText.slice(0, 60) }),
        });
        conversationId.current = conversation.id;
      }
      await api(`/api/conversations/${conversationId.current}/messages`, {
        method: "POST",
        body: JSON.stringify({
          speaker: line.speaker,
          sourceLang: line.sourceLang,
          targetLang: line.targetLang,
          sourceText: line.sourceText,
          translatedText: line.translatedText,
        }),
      });
    } catch (e) {
      setError(`Không lưu được lịch sử: ${(e as Error).message}`);
    }
  }

  async function commit(speaker: Speaker, text: string) {
    const source = langOf(speaker);
    const target = otherOf(speaker);
    interimAbort.current?.abort();
    if (interimTimer.current) clearTimeout(interimTimer.current);
    setLive({ speaker, source: text, translated: "…" });
    try {
      const translated = await translateText(text, source, target);
      const line: Line = {
        key: `${Date.now()}-${Math.random()}`,
        speaker,
        sourceLang: source,
        targetLang: target,
        sourceText: text,
        translatedText: translated,
      };
      setLines((prev) => [...prev, line]);
      setLive(null);
      if (autoSpeak) speak(translated, target);
      void save(line);
    } catch (e) {
      setLive(null);
      setError((e as Error).message);
    }
  }

  function onInterim(speaker: Speaker, text: string) {
    setLive((prev) => ({ speaker, source: text, translated: prev?.speaker === speaker ? prev.translated : "" }));
    if (interimTimer.current) clearTimeout(interimTimer.current);
    interimTimer.current = setTimeout(async () => {
      interimAbort.current?.abort();
      const ctrl = new AbortController();
      interimAbort.current = ctrl;
      try {
        const translated = await translateText(text, langOf(speaker), otherOf(speaker), ctrl.signal);
        setLive((prev) => (prev && prev.speaker === speaker && prev.source === text ? { ...prev, translated } : prev));
      } catch {
        /* interim failures are ignored; the final translation reports errors */
      }
    }, INTERIM_DELAY);
  }

  function toggleMic(speaker: Speaker) {
    setError(null);
    if (listening) {
      rec.current?.stop();
      if (listening === speaker) return;
    }
    window.speechSynthesis?.cancel();
    const r = listen(langOf(speaker), {
      onInterim: (t) => onInterim(speaker, t),
      onFinal: (t) => void commit(speaker, t),
      onError: (m) => setError(m),
      onEnd: () => {
        setListening((cur) => (cur === speaker ? null : cur));
        setLive((prev) => (prev && prev.translated === "" ? null : prev));
      },
    });
    if (!r) {
      setSpeechOk(false);
      return;
    }
    rec.current = r;
    setListening(speaker);
  }

  function toggleAutoSpeak() {
    setAutoSpeak((v) => {
      try {
        localStorage.setItem("tt_autospeak", v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  const half = (s: Speaker) => {
    const lang = langOf(s);
    const isLive = live?.speaker === s;
    const liveForOther = live && live.speaker !== s;
    return (
      <section
        data-testid={`half-${s}`}
        className={`flex min-h-0 flex-1 flex-col gap-2 p-3 ${s === "B" ? "max-md:rotate-180" : ""}`}
      >
        <div className="flex items-center gap-2">
          <select
            aria-label={s === "A" ? "Ngôn ngữ của bạn" : "Ngôn ngữ người đối diện"}
            className="input w-auto py-1 text-sm"
            value={lang}
            onChange={(e) => changeLang(s, e.target.value as LangCode)}
          >
            {LANG_CODES.map((c) => (
              <option key={c} value={c}>
                {LANGUAGES[c].label}
              </option>
            ))}
          </select>
          <span className="muted whitespace-nowrap text-xs">{s === "A" ? "Bạn" : "Người đối diện"}</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" aria-live="polite">
          {lines.length === 0 && !live && (
            <p className="muted m-auto text-center text-sm">
              {LANGUAGES[lang].speech.startsWith("zh") ? "按下麥克風開始說話" : lang === "en" ? "Tap the mic and speak" : "Bấm micro rồi nói"}
            </p>
          )}
          {lines.map((l) =>
            l.speaker === s ? (
              <p key={l.key} className="bubble-own self-end rounded-xl px-3 py-2 text-[15px]">
                {l.sourceText}
              </p>
            ) : (
              <button
                key={l.key}
                type="button"
                title="Nghe lại"
                onClick={() => speak(l.translatedText, l.targetLang)}
                className="bubble-tr self-start rounded-xl px-3 py-2 text-left text-lg"
              >
                {l.translatedText}
              </button>
            ),
          )}
          {isLive && <p className="bubble-own self-end rounded-xl px-3 py-2 opacity-70">{live.source}</p>}
          {liveForOther && live.translated && (
            <p className="bubble-tr self-start rounded-xl px-3 py-2 text-lg opacity-70">{live.translated}</p>
          )}
          <div ref={bottomRefs[s]} />
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("text") as HTMLInputElement;
            const text = input.value.trim();
            if (text) {
              input.value = "";
              void commit(s, text);
            }
          }}
        >
          <input
            name="text"
            className="input text-sm"
            placeholder={lang === "zh-TW" ? "或輸入文字…" : lang === "en" ? "or type…" : "hoặc gõ chữ…"}
            maxLength={1000}
            aria-label={`Gõ chữ (${s === "A" ? "bạn" : "người đối diện"})`}
          />
          <button
            type="button"
            onClick={() => toggleMic(s)}
            disabled={!speechOk}
            aria-pressed={listening === s}
            aria-label={listening === s ? "Dừng nghe" : "Bắt đầu nói"}
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 text-2xl ${
              listening === s ? "animate-pulse border-red-500 bg-red-500 text-white" : "border-[var(--accent)] bg-[var(--accent-soft)]"
            }`}
          >
            🎙
          </button>
        </form>
      </section>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row-reverse">
      {half("B")}
      <div className="relative flex items-center justify-center gap-2 border-y border-[var(--line)] px-2 py-1 md:flex-col md:border-x md:border-y-0">
        <button className="btn rounded-full px-3 py-1 text-sm" onClick={swap} aria-label="Đổi ngôn ngữ hai bên">
          {LANGUAGES[langA].short} ⇄ {LANGUAGES[langB].short}
        </button>
        <button className="btn rounded-full px-3 py-1 text-sm" onClick={toggleAutoSpeak} aria-pressed={autoSpeak}>
          {autoSpeak ? "🔊 Tự đọc" : "🔇 Tắt đọc"}
        </button>
        {!user && (
          <Link href="/login" className="muted text-xs underline">
            Đăng nhập để lưu
          </Link>
        )}
      </div>
      {half("A")}
      {(error || !speechOk) && (
        <div role="alert" className="fixed inset-x-3 bottom-3 z-10 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 shadow">
          {error ?? "Trình duyệt này không hỗ trợ nhận giọng nói (hãy dùng Chrome, Edge hoặc Safari). Bạn vẫn có thể gõ chữ."}
          {error && (
            <button className="ml-2 underline" onClick={() => setError(null)}>
              Đóng
            </button>
          )}
        </div>
      )}
    </div>
  );
}
