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
import "../global.css";

/** Display + body: variable grotesk with width & optical-size axes. */
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  axes: ["wdth", "opsz"],
  display: "swap",
});

/** Editorial italic accent. */
const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin", "vietnamese"],
  style: "italic",
  display: "swap",
});

/** Index numbers & small labels. */
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "vietnamese"],
  display: "swap",
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
        <Intro label={dict.intro.serving} />
        <AppProviders locale={locale} dict={dict}>
          <Header />
          {children}
          <Dock />
          <PageTransition />
        </AppProviders>
      </body>
    </html>
  );
}
