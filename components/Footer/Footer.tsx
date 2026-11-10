import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { Reveal } from "@/components/Reveal/Reveal";
import styles from "./Footer.module.css";

export function Footer({ t, locale }: { t: Dictionary["footer"]; locale: Locale }) {
  const links = [
    { href: `/${locale}/guide`, label: t.guide },
    { href: `/${locale}/privacy`, label: t.privacy },
    { href: `/${locale}/terms`, label: t.terms },
  ];

  return (
    <Reveal className={styles.footer}>
      <p className={styles.tagline} data-reveal>
        <em>{t.tagline}</em>
      </p>
      <span className={styles.rule} data-line />
      <nav className={styles.links} aria-label={`${t.guide} · ${t.privacy} · ${t.terms}`}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={styles.link}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className={styles.meta}>
        <span>{t.credit}</span>
        <span>{t.made}</span>
      </div>
      <p className={styles.giant} aria-hidden data-reveal>
        Ăn gì<span>?</span>
      </p>
    </Reveal>
  );
}
