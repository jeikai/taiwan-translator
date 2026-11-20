"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, LANG_CODES, type LangCode } from "@/lib/languages";
import { translateText } from "@/lib/client";
import { speak } from "@/lib/speech";

export function TextTranslator() {
  const [source, setSource] = useState<LangCode>("zh-TW");
  const [target, setTarget] = useState<LangCode>("vi");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = text.trim();
    if (!t) {
      setResult("");
      return;
    }
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setBusy(true);
      try {
        setResult(await translateText(t, source, target, ctrl.signal));
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        if (abort.current === ctrl) setBusy(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [text, source, target]);

  function pick(which: "source" | "target", value: LangCode) {
    const other = which === "source" ? target : source;
    if (value === other) return swap();
    (which === "source" ? setSource : setTarget)(value);
  }

  function swap() {
    setSource(target);
    setTarget(source);
    if (result) setText(result);
  }

  const select = (which: "source" | "target", value: LangCode) => (
    <select
      aria-label={which === "source" ? "Ngôn ngữ nguồn" : "Ngôn ngữ đích"}
      className="input w-auto"
      value={value}
      onChange={(e) => pick(which, e.target.value as LangCode)}
    >
      {LANG_CODES.map((c) => (
        <option key={c} value={c}>
          {LANGUAGES[c].label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        {select("source", source)}
        <button className="btn" onClick={swap} aria-label="Đổi chiều dịch">
          ⇄
        </button>
        {select("target", target)}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <textarea
          className="input min-h-48 text-lg"
          placeholder="Nhập hoặc dán đoạn văn…"
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Văn bản cần dịch"
        />
        <div className="panel relative min-h-48 rounded-lg p-3 text-lg" data-testid="text-result" aria-live="polite">
          {result || <span className="muted">{busy ? "Đang dịch…" : "Bản dịch hiện ở đây"}</span>}
          {result && (
            <button className="btn absolute bottom-2 right-2 text-sm" onClick={() => speak(result, target)}>
              🔊 Nghe
            </button>
          )}
        </div>
      </div>
      <p className="muted text-xs">{text.length}/1000 ký tự</p>
      {error && (
        <p role="alert" className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}
    </div>
  );
}
