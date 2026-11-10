import "server-only";
import type { Locale } from "@/i18n/config";

const docs = {
  vi: () => import("./vi.json").then((m) => m.default),
  en: () => import("./en.json").then((m) => m.default),
};

export type LegalContent = Awaited<ReturnType<(typeof docs)["vi"]>>;
export type LegalKind = "guide" | "privacy" | "terms";
export type LegalSection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  list?: string[];
  after?: string;
};

/** Legal/guide copy is loaded only by those pages (never shipped to the wheel). */
export const getLegal = (locale: Locale): Promise<LegalContent> => docs[locale]();
