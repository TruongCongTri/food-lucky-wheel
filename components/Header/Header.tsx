"use client";

import Link from "next/link";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher/LanguageSwitcher";
import { SoundToggle } from "@/components/SoundToggle/SoundToggle";
import styles from "./Header.module.css";

export function Header() {
  const { locale } = useI18n();
  const { sound } = useSound();

  return (
    <header className={styles.header}>
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
