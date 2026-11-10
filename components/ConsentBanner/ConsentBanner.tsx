"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import { onIntroDone } from "@/components/Intro/Intro";
import {
  currentChoices,
  OPEN_SETTINGS_EVENT,
  readConsent,
  saveConsent,
  type ConsentChoices,
} from "@/lib/consent";
import styles from "./ConsentBanner.module.css";

/**
 * Privacy & cookie consent (Vietnam PDPL / Taiwan PDPA / GDPR-ePrivacy):
 * - explicit: nothing optional is pre-ticked; silence is never consent;
 * - specific: separate toggles per purpose (preferences, location);
 * - informed: short summary + link to the full Cookies & data page;
 * - Terms must be accepted (contract) — the Privacy policy is acknowledged,
 *   not "consented to" by that checkbox;
 * - withdrawable as easily as given: footer "Cookie settings" reopens this.
 * Shown after the preload curtain, never auto-dismissed.
 */
export function ConsentBanner() {
  const { locale, dict } = useI18n();
  const { sound } = useSound();
  const t = dict.consent;
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [terms, setTerms] = useState(false);
  const [choices, setChoices] = useState<ConsentChoices>({ preferences: false, location: false });
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    // First visit (or a new policy version): ask once the curtain has lifted.
    const cancel = readConsent() ? () => {} : onIntroDone(() => setOpen(true));
    const reopen = () => {
      const rec = readConsent();
      setChoices(currentChoices());
      setTerms(Boolean(rec));
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, reopen);
    return () => {
      cancel();
      window.removeEventListener(OPEN_SETTINGS_EVENT, reopen);
    };
  }, []);

  if (!open) return null;

  const commit = (c: ConsentChoices) => {
    if (!terms) {
      setNudge(true);
      sound.error();
      return;
    }
    sound.click();
    saveConsent(c);
    setOpen(false);
    setCustom(false);
  };

  const toggle = (key: keyof ConsentChoices) => {
    sound.toggle(!choices[key]);
    setChoices((c) => ({ ...c, [key]: !c[key] }));
  };

  const [before, after] = t.terms.split("{terms}");
  const [mid, end] = (after ?? "").split("{privacy}");

  return (
    <div className={styles.banner} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <div className={styles.card}>
        <p id={titleId} className={styles.title}>
          <span className={styles.dot} /> {t.title}
        </p>
        <p className={styles.body}>{t.body}</p>
        <Link href={`/${locale}/cookies`} className={styles.learn}>
          {t.learnMore} →
        </Link>

        {custom && (
          <ul className={styles.cats}>
            <li className={styles.cat}>
              <div>
                <p className={styles.catTitle}>{t.necessary.title}</p>
                <p className={styles.catDesc}>{t.necessary.desc}</p>
              </div>
              <span className={styles.always}>{t.alwaysOn}</span>
            </li>
            {(["preferences", "location"] as const).map((key) => (
              <li key={key} className={styles.cat}>
                <div>
                  <p className={styles.catTitle}>{t[key].title}</p>
                  <p className={styles.catDesc}>{t[key].desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={choices[key]}
                  aria-label={t[key].title}
                  className={styles.switch}
                  data-on={choices[key]}
                  onClick={() => toggle(key)}
                >
                  <span className={styles.knob} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className={styles.terms} data-nudge={nudge && !terms}>
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => {
              setTerms(e.target.checked);
              setNudge(false);
            }}
          />
          <span>
            {before}
            <Link href={`/${locale}/terms`} className={styles.inline}>
              {t.termsLink}
            </Link>
            {mid}
            <Link href={`/${locale}/privacy`} className={styles.inline}>
              {t.privacyLink}
            </Link>
            {end}
          </span>
        </label>
        {nudge && !terms && (
          <p className={styles.hint} role="alert">
            {t.needTerms}
          </p>
        )}

        <div className={styles.actions}>
          {custom ? (
            <button type="button" className={styles.primary} aria-disabled={!terms} onClick={() => commit(choices)}>
              {t.save}
            </button>
          ) : (
            <button
              type="button"
              className={styles.primary}
              aria-disabled={!terms}
              onClick={() => commit({ preferences: true, location: true })}
            >
              {t.acceptAll}
            </button>
          )}
          <button
            type="button"
            className={styles.secondary}
            aria-disabled={!terms}
            onClick={() => commit({ preferences: false, location: false })}
          >
            {t.necessaryOnly}
          </button>
          {!custom && (
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                sound.click();
                setChoices(currentChoices());
                setCustom(true);
              }}
            >
              {t.customize}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
