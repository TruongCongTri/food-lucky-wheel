"use client";

import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { I18nProvider } from "./I18nProvider";
import { SoundProvider } from "./SoundProvider";
import { SmoothScroll } from "./SmoothScroll";

export function AppProviders({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  return (
    <I18nProvider locale={locale} dict={dict}>
      <SoundProvider>
        <SmoothScroll>{children}</SmoothScroll>
      </SoundProvider>
    </I18nProvider>
  );
}
