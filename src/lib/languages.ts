export const LANGUAGES = {
  "zh-TW": { label: "中文（台灣）", short: "中文", speech: "zh-TW", nllb: "zho_Hant" },
  vi: { label: "Tiếng Việt", short: "VI", speech: "vi-VN", nllb: "vie_Latn" },
  en: { label: "English", short: "EN", speech: "en-US", nllb: "eng_Latn" },
} as const;

export type LangCode = keyof typeof LANGUAGES;
export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

export function isLangCode(value: unknown): value is LangCode {
  return typeof value === "string" && value in LANGUAGES;
}
