"use client";

import { useImperativeHandle, useRef, type Ref } from "react";
import gsap from "gsap";
import styles from "./Confetti.module.css";

export type ConfettiHandle = { burst: (origin?: { x: number; y: number }) => void };

const COLORS = ["#e4411f", "#f2c14e", "#6e1f2a", "#1a1414", "#f3ede3"];
const SHAPES = ["50%", "2px", "0"];

/** Lightweight DOM confetti animated with GSAP (no canvas, no extra deps). */
export function Confetti({ ref }: { ref?: Ref<ConfettiHandle> }) {
  const layerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    burst(origin) {
      const layer = layerRef.current;
      if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const x0 = origin?.x ?? window.innerWidth / 2;
      const y0 = origin?.y ?? window.innerHeight * 0.4;
      const count = window.innerWidth < 500 ? 70 : 110;

      for (let i = 0; i < count; i++) {
        const el = document.createElement("i");
        const size = gsap.utils.random(6, 12);
        el.className = styles.piece;
        el.style.cssText = `width:${size}px;height:${size * gsap.utils.random(0.4, 1)}px;background:${gsap.utils.random(COLORS)};border-radius:${gsap.utils.random(SHAPES)};left:${x0}px;top:${y0}px;`;
        layer.appendChild(el);

        const angle = gsap.utils.random(-Math.PI, 0); // upward hemisphere
        const speed = gsap.utils.random(160, 420);
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed;
        const dur = gsap.utils.random(1.4, 2.2);

        gsap
          .timeline({ onComplete: () => el.remove() })
          .to(el, { x: dx * 1.4, duration: dur, ease: "power2.out" }, 0)
          .to(el, { y: dy, duration: dur * 0.35, ease: "power2.out" }, 0)
          .to(el, { y: window.innerHeight - y0 + 40, duration: dur * 0.65, ease: "power1.in" }, dur * 0.35)
          .to(
            el,
            {
              rotation: gsap.utils.random(-720, 720),
              rotationX: gsap.utils.random(-360, 360),
              duration: dur,
              ease: "none",
            },
            0,
          )
          .to(el, { opacity: 0, duration: 0.3 }, dur - 0.3);
      }
    },
  }));

  return <div ref={layerRef} className={styles.layer} aria-hidden />;
}
