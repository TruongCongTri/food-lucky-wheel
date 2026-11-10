"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import styles from "./Marquee.module.css";

gsap.registerPlugin(useGSAP);

type Item = { label: string; emoji: string };

/** Infinite ticker whose speed & direction react to scroll velocity. */
export function Marquee({ items }: { items: Item[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const tween = useRef<gsap.core.Tween | null>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      tween.current = gsap.to("[data-track]", {
        xPercent: -50,
        duration: Math.max(18, items.length * 2.4),
        ease: "none",
        repeat: -1,
      });
    },
    { scope: ref, dependencies: [items.length], revertOnUpdate: true },
  );

  useLenis(({ velocity }) => {
    const t = tween.current;
    if (!t) return;
    const boost = 1 + Math.min(Math.abs(velocity) / 6, 5);
    gsap.to(t, { timeScale: velocity < -0.5 ? -boost : boost, duration: 0.3, overwrite: true });
  });

  if (!items.length) return null;
  const row = (
    <>
      {items.map((it, i) => (
        <span key={i} className={styles.item}>
          {it.label}
          <span className={styles.sep} aria-hidden>
            {it.emoji}
          </span>
        </span>
      ))}
    </>
  );

  return (
    <div ref={ref} className={styles.marquee} aria-hidden>
      <div className={styles.track} data-track>
        <div className={styles.row}>{row}</div>
        <div className={styles.row}>{row}</div>
      </div>
    </div>
  );
}
