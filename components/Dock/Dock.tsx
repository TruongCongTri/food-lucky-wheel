"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import styles from "./Dock.module.css";

/**
 * Menu management is paused for now: the "Menu" item stays visible but only
 * shows an "under development" badge instead of opening /manage.
 * Set to true to link it again.
 */
const MANAGE_ENABLED = false;
const BADGE_MS = 2200;

/** Floating bottom navigation — within thumb reach on phones. */
export function Dock() {
  const { locale, dict } = useI18n();
  const { sound } = useSound();
  const pathname = usePathname();
  const onManage = pathname.startsWith(`/${locale}/manage`);
  const [badge, setBadge] = useState(0); // key: replays the pop-in on each tap
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const showSoon = () => {
    sound.error();
    setBadge(Date.now());
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBadge(0), BADGE_MS);
  };

  return (
    <nav className={styles.dock} aria-label="Main">
      <Link
        href={`/${locale}`}
        className={styles.item}
        data-active={!onManage}
        aria-current={!onManage ? "page" : undefined}
        onClick={() => sound.click()}
      >
        <span className={styles.n}>01</span>
        {dict.nav.wheel}
      </Link>
      {MANAGE_ENABLED ? (
        <Link
          href={`/${locale}/manage`}
          className={styles.item}
          data-active={onManage}
          aria-current={onManage ? "page" : undefined}
          onClick={() => sound.click()}
        >
          <span className={styles.n}>02</span>
          {dict.nav.manage}
        </Link>
      ) : (
        <button type="button" className={styles.item} data-paused onClick={showSoon} aria-describedby="dock-soon">
          <span className={styles.n}>02</span>
          {dict.nav.manage}
          <span id="dock-soon" className={styles.badge} role="status" data-show={badge > 0}>
            {badge > 0 && <span key={badge}>{dict.nav.soon}</span>}
          </span>
        </button>
      )}
    </nav>
  );
}
