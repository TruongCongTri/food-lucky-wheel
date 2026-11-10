"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Scroll-triggered reveal for server-rendered content.
 * Children marked [data-reveal] rise in; [data-line] hairlines draw across.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          gsap.from(el, {
            y: 40,
            opacity: 0,
            duration: 1,
            ease: "expo.out",
            scrollTrigger: { trigger: el, start: "top 90%" },
          });
        });
        gsap.utils.toArray<HTMLElement>("[data-line]").forEach((el) => {
          gsap.from(el, {
            scaleX: 0,
            transformOrigin: "left center",
            duration: 1.2,
            ease: "expo.inOut",
            scrollTrigger: { trigger: el, start: "top 92%" },
          });
        });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
