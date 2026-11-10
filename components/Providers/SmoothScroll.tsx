"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scrolling, driven by GSAP's ticker so scroll, ScrollTrigger
 * and tweens share one requestAnimationFrame loop.
 * Touch devices keep native scrolling (syncTouch off) for the best mobile feel.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    const lenis = lenisRef.current?.lenis;
    const onScroll = () => ScrollTrigger.update();
    lenis?.on("scroll", onScroll);
    return () => {
      gsap.ticker.remove(update);
      lenis?.off("scroll", onScroll);
    };
  }, []);

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{ autoRaf: false, lerp: 0.11, smoothWheel: true, syncTouch: false }}
    >
      {children}
    </ReactLenis>
  );
}
