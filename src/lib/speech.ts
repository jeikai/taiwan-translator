"use client";

import { LANGUAGES, type LangCode } from "./languages";

// Minimal typings for the Web Speech API (not in lib.dom for all TS versions).
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
export interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface ListenHandlers {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export function listen(lang: LangCode, h: ListenHandlers): Recognition | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = LANGUAGES[lang].speech;
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) h.onInterim(finalText + interim);
  };
  rec.onerror = (e) => {
    const map: Record<string, string> = {
      "not-allowed": "Trình duyệt chưa cho phép dùng micro",
      "no-speech": "Không nghe thấy gì, thử lại nhé",
      network: "Lỗi mạng khi nhận giọng nói",
    };
    if (e.error !== "aborted") h.onError(map[e.error] ?? `Lỗi nhận giọng nói: ${e.error}`);
  };
  rec.onend = () => {
    if (finalText.trim()) h.onFinal(finalText.trim());
    h.onEnd();
  };
  rec.start();
  return rec;
}

export function speak(text: string, lang: LangCode, rate = 1) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANGUAGES[lang].speech;
  u.rate = rate;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(u.lang));
  if (voice) u.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
