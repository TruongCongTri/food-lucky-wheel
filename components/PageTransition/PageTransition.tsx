"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useLenis } from "lenis/react";
import { useI18n } from "@/components/Providers/I18nProvider";
import styles from "./PageTransition.module.css";

type Phase = "idle" | "covering" | "covered" | "revealing";

/** Cover: maroon rises, chili follows. */
const COVER_S = 0.45;
const COVER_STAGGER = 0.08;
/** Reveal mirrors the first-load intro exit (Intro.module.css): 0.8s wipes,
 *  maroon trailing chili by 0.2s, same in-out curve. */
const WIPE_S = 0.8;
const WIPE_STAGGER = 0.2;
const EASE_IO = "power4.inOut"; // ≈ cubic-bezier(0.76, 0, 0.24, 1) used by the intro

const SHOWN = "inset(0% 0% 0% 0%)";
const BELOW = "inset(100% 0% 0% 0%)"; // fully clipped, ready to rise from the bottom
const ABOVE = "inset(0% 0% 100% 0%)"; // fully clipped after wiping up
// NOTE: always tween clip-path with fromTo() and full 4-value insets. The
// browser reports computed insets in shorthand ("inset(0%)"), and GSAP can't
// pair 1 number with 4 — the wipe would just jump at the end.

/**
 * The navigation in flight. Module state (not React state) on purpose: a
 * locale switch changes the root [locale] param, which remounts everything
 * under <html> — including this component — mid-animation. The new instance
 * reads this and finishes the curtain from where the old one was.
 */
let pending: { to: string; at: number; resetScroll: boolean } | null = null;

/** The mounted curtain's "cover → swap → reveal" runner (see withCurtain). */
let runner: ((swap: () => void, label?: string) => Promise<void>) | null = null;

/**
 * Play the page-transition curtain around an in-page change — e.g. opening or
 * closing the full-screen places list — so it feels like moving between pages.
 * `swap` runs while the screen is fully covered. Ignored if a curtain is
 * already running; falls back to an instant swap if none is mounted.
 */
export function withCurtain(swap: () => void, label?: string): Promise<void> {
  if (runner) return runner(swap, label);
  swap();
  return Promise.resolve();
}

/** Path without the locale segment, e.g. "/vi/manage" → "/manage". */
const stripLocale = (path: string) => path.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";

const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Loading curtain for in-app navigations, styled like the first-load intro:
 * two stacked layers (chili over maroon) with a spinning mini wheel.
 * A capture-phase click listener catches every internal link (before Next's
 * <Link> handles it), covers the page, and reveals once the new route rendered.
 */
export function PageTransition() {
  const { dict } = useI18n();
  const pathname = usePathname();
  const lenis = useLenis();
  const rootRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<SVGSVGElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const phase = useRef<Phase>("idle");
  const coverDone = useRef(false);
  const arrived = useRef(false);
  const from = useRef(pathname);
  const resetScroll = useRef(true);
  const failsafe = useRef<number | undefined>(undefined);
  const defaultLabel = `${dict.intro.serving}…`;

  const parts = () => ({
    root: rootRef.current,
    back: backRef.current,
    front: frontRef.current,
    wheel: wheelRef.current,
    label: labelRef.current,
  });

  const reveal = useCallback(
    (onRevealed?: () => void) => {
      const { root, back, front, wheel, label } = parts();
      if (!root || !back || !front || phase.current !== "covered") return;
      phase.current = "revealing";
      window.clearTimeout(failsafe.current);
      if (resetScroll.current) lenis?.scrollTo(0, { immediate: true, force: true });
      // Two frames so the new content has painted under the curtain.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const tl = gsap.timeline({
            onComplete: () => {
              gsap.set(root, { autoAlpha: 0 });
              phase.current = "idle";
              pending = null;
              if (labelRef.current) labelRef.current.textContent = defaultLabel;
              onRevealed?.();
            },
          });
          if (prefersReduced()) {
            tl.to(root, { autoAlpha: 0, duration: 0.2 });
            return;
          }
          // Same choreography as the intro exit: content lifts out, then the
          // chili layer wipes up and the maroon layer trails it.
          tl.to(label, { yPercent: -110, duration: 0.45, ease: EASE_IO }, 0)
            .to(wheel, { y: -28, opacity: 0, duration: 0.35, ease: "power2.in" }, 0)
            .fromTo(front, { clipPath: SHOWN }, { clipPath: ABOVE, duration: WIPE_S, ease: EASE_IO }, 0.2)
            .fromTo(back, { clipPath: SHOWN }, { clipPath: ABOVE, duration: WIPE_S, ease: EASE_IO }, 0.2 + WIPE_STAGGER);
        }),
      );
    },
    [lenis, defaultLabel],
  );

  /** Raise the curtain; `onCovered` runs once the screen is fully covered. */
  const coverCore = useCallback((text: string, onCovered: () => void) => {
    const { root, back, front, wheel, label } = parts();
    if (!root || !back || !front) return;
    phase.current = "covering";
    coverDone.current = false;
    if (label) label.textContent = text;

    gsap.killTweensOf([root, back, front, wheel, label]);
    gsap.set(root, { autoAlpha: 1 });
    gsap.set(wheel, { y: 16, opacity: 0 });
    gsap.set(label, { yPercent: 110 });

    const tl = gsap.timeline({
      onComplete: () => {
        coverDone.current = true;
        phase.current = "covered";
        onCovered();
      },
    });
    if (prefersReduced()) {
      gsap.set([back, front], { clipPath: SHOWN });
      gsap.set(wheel, { y: 0, opacity: 1 });
      gsap.set(label, { yPercent: 0 });
      tl.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 });
      return;
    }
    tl.fromTo(back, { clipPath: BELOW }, { clipPath: SHOWN, duration: COVER_S, ease: "expo.inOut" }, 0)
      .fromTo(front, { clipPath: BELOW }, { clipPath: SHOWN, duration: COVER_S, ease: "expo.inOut" }, COVER_STAGGER)
      .to(wheel, { y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, COVER_S - 0.1)
      .to(label, { yPercent: 0, duration: 0.4, ease: "expo.out" }, COVER_S - 0.05);
  }, []);

  /** Page navigation: cover, then wait for the route to change before revealing. */
  const cover = useCallback(
    (toPath: string) => {
      if (!rootRef.current || phase.current !== "idle") return;
      arrived.current = false;
      from.current = window.location.pathname;
      // Language switches keep your place on the page; real page changes go to top.
      resetScroll.current = stripLocale(toPath) !== stripLocale(from.current);
      pending = { to: toPath, at: performance.now(), resetScroll: resetScroll.current };
      coverCore(defaultLabel, () => {
        if (arrived.current) reveal();
      });

      // Never leave the curtain up if a navigation is cancelled or fails.
      window.clearTimeout(failsafe.current);
      failsafe.current = window.setTimeout(() => {
        arrived.current = true;
        if (phase.current === "covered") reveal();
      }, 8000);
    },
    [coverCore, reveal, defaultLabel],
  );

  // In-page "page change": cover → swap content → reveal.
  useEffect(() => {
    runner = (swap, text) =>
      new Promise<void>((resolve) => {
        if (!rootRef.current || phase.current !== "idle") {
          resolve(); // a curtain is already running — ignore repeat taps
          return;
        }
        resetScroll.current = false;
        coverCore(text ?? defaultLabel, () => {
          swap();
          reveal(resolve);
        });
      });
    return () => {
      runner = null;
    };
  }, [coverCore, reveal, defaultLabel]);

  // Catch internal link clicks before Next's <Link> calls preventDefault().
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api")) return;
      if (url.pathname === window.location.pathname) return; // same page (hash, query)
      cover(url.pathname);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [cover]);

  // The route changed → reveal as soon as the cover animation has finished.
  useEffect(() => {
    if (phase.current === "idle" || pathname === from.current || !pending) return;
    arrived.current = true;
    if (coverDone.current) reveal();
  }, [pathname, reveal]);

  // Remounted mid-navigation (locale switch)? Continue the curtain, then reveal.
  // When this instance is hidden/unmounted (route kept alive by Cache
  // Components, or replaced), reset it so a revived layout never shows a stale curtain.
  useEffect(() => {
    const { root, back, front, wheel, label } = parts();
    if (root && back && front && pending && pending.to === window.location.pathname) {
      const progress = Math.min((performance.now() - pending.at) / 1000 / COVER_S, 1);
      phase.current = "covering";
      resetScroll.current = pending.resetScroll;
      arrived.current = true;
      gsap.set(root, { autoAlpha: 1 });
      const partial = `inset(${(1 - progress) * 100}% 0% 0% 0%)`;
      gsap.set(wheel, { y: 0, opacity: 1 });
      gsap.set(label, { yPercent: 0 });
      gsap.fromTo([back, front], { clipPath: partial }, {
        clipPath: SHOWN,
        duration: Math.max(0.12, (1 - progress) * COVER_S),
        ease: "power2.out",
        onComplete: () => {
          coverDone.current = true;
          phase.current = "covered";
          reveal();
        },
      });
    } else {
      pending = null;
    }
    return () => {
      window.clearTimeout(failsafe.current);
      gsap.killTweensOf([root, back, front, wheel, label]);
      if (root) gsap.set(root, { autoAlpha: 0 });
      if (back && front) gsap.set([back, front], { clipPath: BELOW });
      phase.current = "idle";
      coverDone.current = false;
      arrived.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only
  }, []);

  return (
    <div ref={rootRef} className={styles.overlay} aria-hidden>
      <div ref={backRef} className={styles.back} />
      <div ref={frontRef} className={styles.front}>
        <div className={styles.content}>
          <svg ref={wheelRef} className={styles.wheel} viewBox="0 0 40 40" aria-hidden>
            <g transform="translate(20 20)">
              <path d="M0 0 L0 -18 A18 18 0 0 1 18 0 Z" fill="#f3ede3" />
              <path d="M0 0 L18 0 A18 18 0 0 1 0 18 Z" fill="#f2c14e" />
              <path d="M0 0 L0 18 A18 18 0 0 1 -18 0 Z" fill="#6e1f2a" />
              <path d="M0 0 L-18 0 A18 18 0 0 1 0 -18 Z" fill="#1a1414" />
              <circle r="18" fill="none" stroke="#1a1414" strokeWidth="2.5" />
              <circle r="5" fill="#1a1414" stroke="#f3ede3" strokeWidth="2" />
            </g>
          </svg>
          {/* Masked like the intro letters, so the label lifts out of view */}
          <span className={styles.mask}>
            <span ref={labelRef} className={styles.label}>
              {defaultLabel}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
