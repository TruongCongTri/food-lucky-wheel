import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Bricolage_Grotesque, Fraunces, JetBrains_Mono } from "next/font/google";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { AppProviders } from "@/components/Providers/AppProviders";
import { Header } from "@/components/Header/Header";
import { Dock } from "@/components/Dock/Dock";
import { Intro, INTRO_SCRIPT } from "@/components/Intro/Intro";
import { PageTransition } from "@/components/PageTransition/PageTransition";
import { ConsentBanner } from "@/components/ConsentBanner/ConsentBanner";
import { MusicPlayer } from "@/components/MusicPlayer/MusicPlayer";
import { Cursor } from "@/components/Cursor/Cursor";
import "../global.css";

/**
 * Display + body: variable grotesk. Only the width axis (for the condensed
 * headings) — the optical-size axis nearly doubled the file (128 KB latin).
 * The only preloaded font: it sets the headline and the wheel labels.
 */
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  axes: ["wdth"],
  display: "swap",
});

/**
 * Editorial italic accent and mono labels: not preloaded, so on slow
 * connections they don't compete with the JavaScript that renders the wheel;
 * they swap in when ready. (`display: optional` was tried and rejected: first
 * visits almost never got the font in time, losing the editorial mono look.)
 */
const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin", "vietnamese"],
  style: "italic",
  display: "swap",
  preload: false,
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "vietnamese"],
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    applicationName: dict.header.brand,
    appleWebApp: { capable: true, title: dict.header.brand, statusBarStyle: "default" },
    formatDetection: { telephone: false },
    alternates: { languages: { vi: "/vi", en: "/en" } },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3ede3",
  colorScheme: "light",
};

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  // (No preconnect to Wikimedia: dish photos are proxied through /api/img, so
  // the browser never contacts a third-party image host.)

  return (
    <html
      lang={locale}
      className={`${display.variable} ${serif.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Marks the intro as playing before first paint (see Intro.tsx). */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      </head>
      <body>
        <Intro label={dict.intro.serving} message={dict.intro.message} />
        <AppProviders locale={locale} dict={dict}>
          <Header />
          {children}
          <Dock />
          <MusicPlayer />
          <ConsentBanner />
          <PageTransition />
          <Cursor />
        </AppProviders>
      </body>
    </html>
  );
}
