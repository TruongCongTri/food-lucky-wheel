import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { LegalKind, LegalSection } from "@/content/legal";
import styles from "./LegalPage.module.css";

type Props = {
  locale: Locale;
  kind: LegalKind;
  label: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  updatedLabel: string;
  updated: string;
  contentsLabel: string;
  relatedLabel: string;
  links: Record<LegalKind, string>;
  vars: Record<string, string>;
  /** Extra UI rendered inside a section (e.g. the consent control). */
  slots?: Partial<Record<string, ReactNode>>;
};

const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

/** Editorial long-form layout for Guide / Privacy / Terms. */
export function LegalPage({
  locale,
  kind,
  label,
  title,
  intro,
  sections,
  updatedLabel,
  updated,
  contentsLabel,
  relatedLabel,
  links,
  vars,
  slots,
}: Props) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(updated));
  const others = (Object.keys(links) as LegalKind[]).filter((k) => k !== kind);

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <p className={styles.meta}>
          <span className={styles.index}>(§)</span> {label}
        </p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.intro}>{fill(intro, vars)}</p>
        <p className={styles.updated}>
          {updatedLabel}: <time dateTime={updated}>{date}</time>
        </p>
      </header>

      <nav className={styles.toc} aria-label={contentsLabel}>
        <p className={styles.tocLabel}>{contentsLabel}</p>
        <ol>
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>
                <span className={styles.tocNum}>{String(i + 1).padStart(2, "0")}</span> {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s, i) => (
        <section key={s.id} id={s.id} className={styles.section}>
          <h2 className={styles.heading}>
            <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
            {s.heading}
          </h2>
          {s.paragraphs?.map((p, k) => (
            <p key={k} className={styles.p}>
              {fill(p, vars)}
            </p>
          ))}
          {s.list && (
            <ul className={styles.list}>
              {s.list.map((item, k) => (
                <li key={k}>{fill(item, vars)}</li>
              ))}
            </ul>
          )}
          {s.after && <p className={styles.p}>{fill(s.after, vars)}</p>}
          {slots?.[s.id]}
        </section>
      ))}

      <nav className={styles.related} aria-label={relatedLabel}>
        <p className={styles.tocLabel}>{relatedLabel}</p>
        <div className={styles.relatedLinks}>
          {others.map((k) => (
            <Link key={k} href={`/${locale}/${k}`} className={styles.relatedLink}>
              {links[k]} <span aria-hidden>→</span>
            </Link>
          ))}
        </div>
      </nav>
    </article>
  );
}
