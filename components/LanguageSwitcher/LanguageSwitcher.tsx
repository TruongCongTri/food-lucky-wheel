"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, locales } from "@/i18n/config";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import styles from "./LanguageSwitcher.module.css";

export function LanguageSwitcher() {
  const { locale, dict } = useI18n();
  const { sound } = useSound();
  const pathname = usePathname();

  const hrefFor = (target: string) => {
    const parts = pathname.split("/");
    parts[1] = target;
    return parts.join("/") || `/${target}`;
  };

  return (
    <div className={styles.switcher} role="group" aria-label={dict.header.language}>
      {locales.map((l, i) => (
        <span key={l} className={styles.item}>
          {i > 0 && (
            <span className={styles.slash} aria-hidden>
              /
            </span>
          )}
          <Link
            href={hrefFor(l)}
            replace
            scroll={false}
            className={styles.option}
            data-active={l === locale}
            aria-current={l === locale ? "true" : undefined}
            onClick={() => {
              sound.click();
              document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
            }}
          >
            {l.toUpperCase()}
          </Link>
        </span>
      ))}
    </div>
  );
}
