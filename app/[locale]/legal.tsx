import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLegal, type LegalKind } from "@/content/legal";
import { LEGAL_UPDATED, operator } from "@/lib/site";
import { LegalPage } from "@/components/LegalPage/LegalPage";
import { Footer } from "@/components/Footer/Footer";
import styles from "./legal.module.css";

/** Shared metadata + rendering for /[locale]/guide, /privacy and /terms. */
export async function legalMetadata(locale: string, kind: LegalKind): Promise<Metadata> {
  if (!hasLocale(locale)) return {};
  const [legal, dict] = await Promise.all([getLegal(locale), getDictionary(locale)]);
  return {
    title: `${legal[kind].title} · ${dict.header.brand}`,
    description: legal[kind].intro,
    alternates: { languages: { vi: `/vi/${kind}`, en: `/en/${kind}` } },
  };
}

export async function renderLegal(
  locale: string,
  kind: LegalKind,
  slots?: (legal: Awaited<ReturnType<typeof getLegal>>, locale: Locale) => Record<string, ReactNode>,
) {
  if (!hasLocale(locale)) notFound();
  const [legal, dict] = await Promise.all([getLegal(locale), getDictionary(locale)]);
  const doc = legal[kind];

  return (
    <main className={styles.main}>
      <LegalPage
        locale={locale}
        kind={kind}
        label={doc.label}
        title={doc.title}
        intro={doc.intro}
        sections={doc.sections}
        updatedLabel={legal.common.updated}
        updated={LEGAL_UPDATED}
        contentsLabel={legal.common.contents}
        relatedLabel={legal.common.related}
        links={{ guide: dict.footer.guide, privacy: dict.footer.privacy, terms: dict.footer.terms }}
        vars={{ operator: operator.name, email: operator.email, address: operator.address }}
        slots={slots?.(legal, locale)}
      />
      <Footer t={dict.footer} locale={locale} />
    </main>
  );
}
