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

  useGSAP(
    () => {
      gsap.fromTo("[data-backdrop]", { opacity: 0 }, { opacity: 1, duration: 0.3 });
      gsap.fromTo(
        "[data-card]",
        { y: 60, scale: 0.92, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.6)" },
      );
    },
    { scope: rootRef },
  );

  const dismiss = useCallback(
    (after: () => void) => {
      if (closing.current) return;
      closing.current = true;
      gsap.to(rootRef.current?.querySelector("[data-backdrop]") ?? [], { opacity: 0, duration: 0.25 });
      gsap.to(rootRef.current?.querySelector("[data-card]") ?? [], {
        y: 40,
        scale: 0.95,
        opacity: 0,
        duration: 0.25,
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
