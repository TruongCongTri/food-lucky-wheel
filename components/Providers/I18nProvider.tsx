"use client";

import { createContext, use, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type I18nValue = { locale: Locale; dict: Dictionary };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: I18nValue & { children: ReactNode }) {
  return <I18nContext value={{ locale, dict }}>{children}</I18nContext>;
}

export function useI18n() {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Replace `{name}` placeholders in a message. */
export function fmt(message: string, vars: Record<string, string | number>) {
  return message.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
