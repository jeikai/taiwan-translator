import { z } from "zod";
import { LANG_CODES } from "./languages";

const lang = z.enum(LANG_CODES as [string, ...string[]]);
export const MAX_TEXT = 1000;

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(128),
  name: z.string().trim().min(1).max(60),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const translateSchema = z
  .object({
    text: z.string().trim().min(1).max(MAX_TEXT),
    source: lang,
    target: lang,
  })
  .refine((v) => v.source !== v.target, { message: "Ngôn ngữ nguồn và đích phải khác nhau" });

export const createConversationSchema = z
  .object({
    title: z.string().trim().max(120).optional(),
    langA: lang,
    langB: lang,
  })
  .refine((v) => v.langA !== v.langB, { message: "Hai ngôn ngữ phải khác nhau" });

export const renameConversationSchema = z.object({ title: z.string().trim().min(1).max(120) });

export const addMessageSchema = z.object({
  speaker: z.enum(["A", "B"]),
  sourceLang: lang,
  targetLang: lang,
  sourceText: z.string().trim().min(1).max(MAX_TEXT),
  translatedText: z.string().trim().min(1).max(MAX_TEXT * 4),
});

export const objectIdLike = z.string().regex(/^[a-f0-9]{24}$/i);
