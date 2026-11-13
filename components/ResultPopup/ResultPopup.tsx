"use client";

import { useCallback, useEffect, useRef, type Ref } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import type { Dish } from "@/lib/dishes/types";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import { Readout, type ReadoutHandle } from "@/components/Readout/Readout";
import styles from "./ResultPopup.module.css";

gsap.registerPlugin(useGSAP);

type Props = {
  readoutRef?: Ref<ReadoutHandle>;
  dish: Dish;
  onClose: () => void;
  onFindPlaces: (origin: { x: number; y: number }) => void;
  onSpinAgain: () => void;
};

/** Phone layout: the picked dish pops up over the wheel. */
export function ResultPopup({ readoutRef, dish, onClose, onFindPlaces, onSpinAgain }: Props) {
  const { dict } = useI18n();
  const { sound } = useSound();
  const lenis = useLenis();
  const rootRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  // Entrance: one slide-up of the whole card plus a backdrop fade —
  // transform/opacity only, no scale or overshoot, so it stays on the GPU
  // compositor even on old phones. The timeline is built paused and started on
  // the next frame: mounting the popup is the expensive frame, and starting the
  // clock after it means the first visible frame is the start of the motion,
  // not a jump into the middle of it.
  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tl = gsap
        .timeline({ paused: true })
        .fromTo("[data-backdrop]", { opacity: 0 }, { opacity: 1, duration: reduced ? 0.15 : 0.32, ease: "none" }, 0)
        .fromTo(
          "[data-card]",
          reduced ? { opacity: 0 } : { y: 90, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: reduced ? 0.15 : 0.46,
            ease: "power3.out",
            force3D: true,
            clearProps: "transform", // crisp text once settled
          },
          0,
        );
      const raf = requestAnimationFrame(() => void tl.play());
      return () => cancelAnimationFrame(raf);
    },
    { scope: rootRef },
  );

  const dismiss = useCallback(
    (after: () => void) => {
      if (closing.current) return;
      closing.current = true;
      gsap.to(rootRef.current?.querySelector("[data-backdrop]") ?? [], { opacity: 0, duration: 0.25 });
      gsap.to(rootRef.current?.querySelector("[data-card]") ?? [], {
        y: 60,
        opacity: 0,
        duration: 0.22,
        force3D: true,
        ease: "power2.in",
        onComplete: after,
      });
    },
    [],
  );

  const close = useCallback(() => {
    sound.click();
    dismiss(onClose);
  }, [dismiss, onClose, sound]);

  useEffect(() => {
    lenis?.stop();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      window.removeEventListener("keydown", onKey);
    };
  }, [lenis, close]);

  return (
    <div ref={rootRef} className={styles.root} role="dialog" aria-modal="true" aria-label={dict.result.youGot}>
      <div className={styles.backdrop} data-backdrop onClick={close} />
      <div className={styles.card} data-card>
        <button type="button" className={styles.close} onClick={close} aria-label={dict.result.close}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
        <Readout
          ref={readoutRef}
          entrance="light"
          phase="result"
          dish={dish}
          canSpin
          onFindPlaces={onFindPlaces}
          onSpinAgain={() => {
            sound.click();
            dismiss(onSpinAgain);
          }}
        />
      </div>
    </div>
  );
}
