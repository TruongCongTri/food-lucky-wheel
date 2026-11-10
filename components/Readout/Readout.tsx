"use client";

import { useImperativeHandle, useRef, type Ref } from "react";
import Link from "next/link";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import type { Dish } from "@/lib/dishes/types";
import { dishImageSrc } from "@/lib/dishes/imageSrc";
import { THUMB_W } from "@/lib/dishes/imagePreload";
import { isLowEndDevice } from "@/lib/device";
import { ResultPhoto } from "@/components/ResultPhoto/ResultPhoto";
import { useI18n } from "@/components/Providers/I18nProvider";
import { introActive, onIntroExit } from "@/components/Intro/Intro";
import styles from "./Readout.module.css";

gsap.registerPlugin(useGSAP, SplitText);

export type Phase = "idle" | "spinning" | "result";
export type ReadoutHandle = {
  /** Imperatively show the dish under the pointer (runs ~30×/s while spinning). */
  live: (dish: Dish) => void;
  /** Screen point of the result photo (for confetti / reveal origins). */
  photoCenter: () => { x: number; y: number } | null;
};

type Props = {
  ref?: Ref<ReadoutHandle>;
  className?: string;
  phase: Phase;
  dish: Dish | null;
  canSpin: boolean;
  onFindPlaces: (origin: { x: number; y: number }) => void;
  onSpinAgain: () => void;
};

/**
 * The panel the pointer aims at (left of the wheel): headline when idle,
 * a live "slot" while spinning, and the picked dish when the wheel stops.
 */
export function Readout({ ref, className, phase, dish, canSpin, onFindPlaces, onSpinAgain }: Props) {
  const { locale, dict } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const liveImg = useRef<HTMLImageElement>(null);
  const liveEmoji = useRef<HTMLSpanElement>(null);
  const liveName = useRef<HTMLSpanElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    live(d) {
      if (liveName.current) liveName.current.textContent = d.name[locale];
      if (liveImg.current && liveEmoji.current) {
        const show = Boolean(d.image);
        // Same 330px variant the wheel already loaded → served from cache.
        if (d.image) liveImg.current.src = dishImageSrc(d.image, THUMB_W);
        liveImg.current.style.opacity = show ? "1" : "0";
        liveEmoji.current.textContent = show ? "" : d.emoji;
      }
    },
    photoCenter() {
      const r = photoRef.current?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    },
  }));

  // Entrance choreography per phase.
  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      if (phase === "idle") {
        // Only behind the preload curtain — otherwise the text is already showing.
        if (!introActive()) return;
        // Prepare (hidden) under the curtain, play as it lifts.
        let split: SplitText | undefined;
        let chars: gsap.core.Tween | undefined;
        let exited = false;
        let cancelled = false;
        const fade = gsap.from("[data-fade]", { y: 14, opacity: 0, duration: 0.7, stagger: 0.08, paused: true });
        // Fonts first so the split measures real glyphs (capped: document.fonts can stall on iOS).
        Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(() => {
          if (cancelled) return;
          split = SplitText.create("[data-split]", { type: "words,chars", mask: "words", wordsClass: "split-word" });
          chars = gsap.from(split.chars, { yPercent: 120, duration: 0.9, stagger: 0.03, ease: "expo.out", paused: true });
          if (exited) chars.play(); // curtain already lifting
        });
        const cancelExit = onIntroExit((delay) => {
          gsap.delayedCall(delay, () => {
            exited = true;
            chars?.play();
          });
          gsap.delayedCall(delay + 0.5, () => void fade.play());
        });
        return () => {
          cancelled = true;
          cancelExit();
          split?.revert();
        };
      }
      if (phase === "spinning") {
        gsap.from("[data-fade]", { x: -16, opacity: 0, duration: 0.4, stagger: 0.05, ease: "power3.out" });
      }
      if (phase === "result") {
        // Deliberately cheap: no per-letter SplitText here — splitting the name
        // forces a synchronous layout exactly at the result moment, which made
        // the reveal stutter on phones. Transforms + opacity only.
        const lowEnd = isLowEndDevice();
        gsap
          .timeline()
          .from("[data-photo]", lowEnd
            ? { opacity: 0, y: 12, duration: 0.4, ease: "power2.out" }
            : { scale: 0.4, rotate: -30, duration: 0.9, ease: "back.out(1.8)" })
          .from("[data-split]", { y: 26, opacity: 0, duration: 0.6, ease: "expo.out" }, 0.1)
          .from("[data-fade]", { y: 14, opacity: 0, duration: 0.5, stagger: 0.07, ease: "power3.out" }, 0.3);
      }
    },
    { scope: rootRef, dependencies: [phase, dish?.id], revertOnUpdate: true },
  );

  const words = [
    ...dict.hero.line1.split(" ").map((w) => ({ w, em: false })),
    { w: dict.hero.accent, em: true },
    ...dict.hero.line2.split(" ").map((w) => ({ w, em: false })),
  ];

  return (
    <div ref={rootRef} className={`${styles.readout} ${className ?? ""}`} data-phase={phase}>
      {phase === "idle" && (
        <>
          <p className={styles.label} data-fade>
            <span className={styles.index}>{dict.hero.index}</span> {dict.hero.label}
          </p>
          <h1 className={styles.headline}>
            {words.map(({ w, em }, i) => (
              <span key={i} className={styles.word} data-split>
                {em ? <em>{w}</em> : w}
              </span>
            ))}
          </h1>
          <p className={styles.lede} data-fade>
            {dict.hero.lede}
          </p>
          {canSpin ? (
            <p className={styles.hint} data-fade>
              <span className={styles.arrow}>→</span> {dict.wheel.tapToSpin}
            </p>
          ) : (
            <div className={styles.empty} data-fade>
              <p>{dict.wheel.notEnough}</p>
              <Link href={`/${locale}/manage`} className={styles.secondary}>
                {dict.wheel.goManage} →
              </Link>
            </div>
          )}
        </>
      )}

      {phase === "spinning" && (
        <>
          <p className={styles.label} data-fade>
            <span className={styles.dot} /> {dict.wheel.current}
          </p>
          <div className={styles.photo} data-fade>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={liveImg} alt="" decoding="async" crossOrigin="anonymous" />
            <span ref={liveEmoji} className={styles.photoEmoji} aria-hidden />
          </div>
          <span ref={liveName} className={styles.liveName} aria-live="off" data-fade>
            …
          </span>
        </>
      )}

      {phase === "result" && dish && (
        <>
          <p className={styles.label} data-fade>
            <span className={styles.dot} /> {dict.result.youGot}
          </p>
          <div ref={photoRef} className={`${styles.photo} ${styles.photoResult}`} data-photo>
            <ResultPhoto image={dish.image} emoji={dish.emoji} alt={dish.name[locale]} />
          </div>
          <h2 className={styles.name} aria-live="polite">
            <span data-split>{dish.name[locale]}</span>
          </h2>
          {dish.name.vi !== dish.name.en && (
            <p className={styles.alt} data-fade>
              {dish.name[locale === "vi" ? "en" : "vi"]}
            </p>
          )}
          <div className={styles.actions} data-fade>
            <button
              type="button"
              className={styles.primary}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onFindPlaces({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
              }}
            >
              <span className={styles.long}>{dict.result.findPlaces}</span>
              <span className={styles.short}>{dict.result.findPlacesShort} ↗</span>
              <span className={styles.btnIcon} aria-hidden>
                ↗
              </span>
            </button>
            <button type="button" className={styles.secondary} onClick={onSpinAgain}>
              ↻ {dict.result.spinAgain}
            </button>
          </div>
          {dish.image && dish.imagePage && (
            <a className={styles.credit} href={dish.imagePage} target="_blank" rel="noopener noreferrer" data-fade>
              {dict.result.photoCredit}
            </a>
          )}
        </>
      )}
    </div>
  );
}
