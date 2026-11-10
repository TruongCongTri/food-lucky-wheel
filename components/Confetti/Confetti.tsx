"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { isLowEndDevice, prefersReducedMotion } from "@/lib/device";
import styles from "./Confetti.module.css";

export type ConfettiHandle = { burst: (origin?: { x: number; y: number }) => void };

const COLORS = ["#e4411f", "#f2c14e", "#6e1f2a", "#1a1414", "#f3ede3"];
const GRAVITY = 1400; // px/s²
const DURATION = 1.9; // s

type Particle = {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; rot: number; vr: number;
  flip: number; vf: number; color: string; round: boolean;
};

/**
 * Canvas confetti: one 2D canvas and a single rAF loop that only runs during a
 * burst. Replaces ~100 GSAP-animated DOM pieces (350+ tweens writing styles
 * and 3D transforms every frame), which made the result moment stutter on
 * weak phones. Fewer particles on low-end devices; none with reduced motion.
 */
export function Confetti({ ref }: { ref?: Ref<ConfettiHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => () => cancelAnimationFrame(raf.current ?? 0), []);

  useImperativeHandle(ref, () => ({
    burst(origin) {
      const canvas = canvasRef.current;
      if (!canvas || prefersReducedMotion()) return;
      const lowEnd = isLowEndDevice();
      const W = window.innerWidth;
      const H = window.innerHeight;
      const dpr = lowEnd ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const x0 = origin?.x ?? W / 2;
      const y0 = origin?.y ?? H * 0.4;
      const count = lowEnd ? 36 : W < 500 ? 70 : 110;
      const rnd = (a: number, b: number) => a + Math.random() * (b - a);
      const parts: Particle[] = Array.from({ length: count }, () => {
        const angle = rnd(-Math.PI * 0.95, -Math.PI * 0.05); // upward fan
        const speed = rnd(380, 900);
        const size = rnd(6, 12);
        return {
          x: x0, y: y0,
          vx: Math.cos(angle) * speed * 0.8, vy: Math.sin(angle) * speed,
          w: size, h: size * rnd(0.4, 1),
          rot: rnd(0, Math.PI * 2), vr: rnd(-12, 12),
          flip: rnd(0, Math.PI * 2), vf: rnd(6, 14),
          color: COLORS[(Math.random() * COLORS.length) | 0],
          round: Math.random() < 0.3,
        };
      });

      cancelAnimationFrame(raf.current ?? 0);
      canvas.dataset.active = "true";
      let last = performance.now();
      const start = last;
      const frame = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.05); // clamp after a hitch
        last = now;
        const t = (now - start) / 1000;
        ctx.clearRect(0, 0, W, H);
        const fade = t > DURATION - 0.4 ? Math.max(0, (DURATION - t) / 0.4) : 1;
        ctx.globalAlpha = fade;
        for (const p of parts) {
          p.vy += GRAVITY * dt;
          p.vx *= 0.99;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          p.flip += p.vf * dt;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.flip)); // cheap "tumbling" without 3D
          ctx.fillStyle = p.color;
          if (p.round) {
            ctx.beginPath();
            ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          }
          ctx.restore();
        }
        if (t < DURATION) {
          raf.current = requestAnimationFrame(frame);
        } else {
          ctx.clearRect(0, 0, W, H);
          canvas.dataset.active = "false";
        }
      };
      raf.current = requestAnimationFrame(frame);
    },
  }));

  return <canvas ref={canvasRef} className={styles.layer} aria-hidden />;
}
