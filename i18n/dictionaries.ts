import "server-only";
import type { Locale } from "./config";

const dictionaries = {
  vi: () => import("./messages/vi.json").then((m) => m.default),
  en: () => import("./messages/en.json").then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["vi"]>>;

export const getDictionary = async (locale: Locale): Promise<Dictionary> =>
  dictionaries[locale]();
