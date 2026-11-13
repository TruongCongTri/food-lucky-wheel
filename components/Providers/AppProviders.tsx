"use client";

import { useEffect, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { expectGate, markHydrated, waitFor } from "@/lib/appReady";
import { I18nProvider } from "./I18nProvider";
import { SoundProvider } from "./SoundProvider";
import { AudioProvider } from "./AudioProvider";
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
  // Parent effects run after their children's, so by now every component on
  // the page has registered what the preload curtain should wait for.
  useEffect(() => {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
    // Brand font (headline + wheel labels). document.fonts can stall on iOS — capped.
    waitFor(family ? document.fonts?.load(`800 48px ${family}`, "ĂN GÌ") : null, 2500);
    // Sections that hydrate later (inside Suspense) announce themselves in the HTML.
    document.querySelectorAll<HTMLElement>("[data-ready-gate]").forEach((el) => {
      if (el.dataset.readyGate) expectGate(el.dataset.readyGate, 3500);
    });
    markHydrated();
  }, []);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <SoundProvider>
        <AudioProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </AudioProvider>
      </SoundProvider>
    </I18nProvider>
  );
}
