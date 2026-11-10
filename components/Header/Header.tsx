"use client";

import Link from "next/link";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher/LanguageSwitcher";
import { SoundToggle } from "@/components/SoundToggle/SoundToggle";
import styles from "./Header.module.css";

export function Header() {
  const { locale, dict } = useI18n();
  const { sound } = useSound();
  const message = (
    <span className={styles.message}>
      <span className={styles.heart} aria-hidden>
        ♥
      </span>
      {dict.header.tagline}
      <span className={styles.heart} aria-hidden>
        ♥
      </span>
    </span>
  );

  return (
    <header className={styles.header}>
      {/* Tagline: centered on wide screens, a gentle ticker on narrow ones */}
      <div className={styles.tagline}>
        <p className="visually-hidden">{dict.header.tagline}</p>
        <div className={styles.track} aria-hidden>
          {message}
          <span className={styles.copy}>{message}</span>
        </div>
      </div>
      <div className={styles.inner}>
        <Link href={`/${locale}`} className={styles.brand} onClick={() => sound.click()}>
          Ăn gì<span className={styles.q}>?</span>
          <sup className={styles.sup}>®26</sup>
        </Link>
        <div className={styles.actions}>
          <SoundToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
