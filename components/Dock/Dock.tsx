"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import styles from "./Dock.module.css";

/** Floating bottom navigation — within thumb reach on phones. */
export function Dock() {
  const { locale, dict } = useI18n();
  const { sound } = useSound();
  const pathname = usePathname();
  const onManage = pathname.startsWith(`/${locale}/manage`);

  const items = [
    { href: `/${locale}`, label: dict.nav.wheel, active: !onManage, n: "01" },
    { href: `/${locale}/manage`, label: dict.nav.manage, active: onManage, n: "02" },
  ];

  return (
    <nav className={styles.dock} aria-label="Main">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={styles.item}
          data-active={it.active}
          aria-current={it.active ? "page" : undefined}
          onClick={() => sound.click()}
        >
          <span className={styles.n}>{it.n}</span>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
