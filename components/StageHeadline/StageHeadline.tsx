"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { useI18n } from "@/components/Providers/I18nProvider";
import { introPlaying } from "@/components/Intro/Intro";
import styles from "./StageHeadline.module.css";

gsap.registerPlugin(useGSAP, SplitText);

/** Phone layout: "Hôm nay ăn gì đây?" sits above the wheel. */
export function StageHeadline({ className, canSpin }: { className?: string; canSpin: boolean }) {
  const { locale, dict } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const delay = introPlaying() ? 1.35 : 0.1;
        let split: SplitText | undefined;
        document.fonts.ready.then(() => {
          split = SplitText.create("[data-split]", { type: "words,chars", mask: "words", wordsClass: "split-word" });
          gsap.from(split.chars, { yPercent: 120, duration: 0.9, stagger: 0.025, ease: "expo.out", delay });
        });
        gsap.from("[data-fade]", { y: 12, opacity: 0, duration: 0.7, stagger: 0.08, delay: delay + 0.4 });
        return () => split?.revert();
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={`${styles.headline} ${className ?? ""}`}>
      <p className={styles.label} data-fade>
        <span className={styles.index}>{dict.hero.index}</span> {dict.hero.label}
      </p>
      <h1 className={styles.title} data-split>
        {dict.hero.line1} <em>{dict.hero.accent}</em> {dict.hero.line2}
      </h1>
      <p className={styles.lede} data-fade>
        {dict.hero.lede}
      </p>
      {canSpin ? (
        <p className={styles.hint} data-fade>
          <span className={styles.arrow}>↓</span> {dict.wheel.tapToSpin}
        </p>
      ) : (
        <p className={`${styles.hint} ${styles.keep}`} data-fade>
          {dict.wheel.notEnough}{" "}
          <Link href={`/${locale}/manage`} className={styles.link}>
            {dict.wheel.goManage} →
          </Link>
        </p>
      )}
    </div>
  );
}
