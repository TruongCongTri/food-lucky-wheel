"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useI18n } from "@/components/Providers/I18nProvider";
import styles from "./Cursor.module.css";

/** Mouse / trackpad only — touch devices keep their native behaviour. */
const FINE = "(hover: hover) and (pointer: fine)";
const INTERACTIVE = 'a[href], button:not(:disabled), [role="button"], [role="switch"], label, select, summary, input[type="checkbox"], input[type="range"]';
/** Native text caret stays here (custom cursor hides). */
const TEXT = 'input:not([type="checkbox"]):not([type="range"]):not([type="radio"]), textarea, [contenteditable="true"]';

type State = "default" | "hover" | "link" | "grab" | "drag" | "text";

/**
 * Custom cursor (desktop): an ink dot that tracks the pointer exactly, plus a
 * ring that trails it.
 *  - default: small ring
 *  - hover:   ring grows and fills over buttons / links
 *  - link:    external links show an arrow ("pointing" out of the site)
 *  - grab:    over the wheel face — "drag" label with turn arrows
 *  - drag:    while turning the wheel — filled chili, "release" label
 *  - pressed: ring squeezes
 * Only transforms and opacity change per frame; the state is a data attribute
 * set on change, not every move.
 */
export function Cursor() {
  const { dict } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia(FINE);
    const root = rootRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!root || !dot || !ring) return;

    let cleanup: (() => void) | null = null;

    const enable = () => {
      const html = document.documentElement;
      html.dataset.cursor = "on";
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dur = reduced ? 0 : 0.35;
      const ringX = gsap.quickTo(ring, "x", { duration: dur, ease: "power3.out" });
      const ringY = gsap.quickTo(ring, "y", { duration: dur, ease: "power3.out" });
      let state: State = "default";
      let last: EventTarget | null = null;
      let visible = false;

      const setState = (s: State) => {
        if (s === state) return;
        state = s;
        root.dataset.state = s;
      };

      const classify = (target: EventTarget | null): State => {
        const el = target instanceof Element ? target : null;
        if (!el) return "default";
        if (el.closest('[data-dragging="true"]')) return "drag";
        if (el.closest('[data-can-drag="true"]')) return "grab";
        if (el.closest(TEXT)) return "text";
        const hit = el.closest(INTERACTIVE);
        if (!hit) return "default";
        if (hit instanceof HTMLAnchorElement && hit.target === "_blank") return "link";
        return "hover";
      };

      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        ringX(e.clientX);
        ringY(e.clientY);
        if (!visible) {
          visible = true;
          gsap.set(ring, { x: e.clientX, y: e.clientY });
          root.dataset.visible = "true";
        }
        if (e.target !== last || state === "drag" || state === "grab") {
          last = e.target;
          setState(classify(e.target));
        }
      };
      const onDown = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        root.dataset.pressed = "true";
        // The wheel marks itself as dragging inside its own pointerdown.
        requestAnimationFrame(() => setState(classify(e.target)));
      };
      const onUp = (e: PointerEvent) => {
        root.dataset.pressed = "false";
        requestAnimationFrame(() => setState(classify(document.elementFromPoint(e.clientX, e.clientY))));
      };
      const onLeave = () => {
        visible = false;
        root.dataset.visible = "false";
      };
      const onOut = (e: MouseEvent) => {
        if (!e.relatedTarget) onLeave(); // left the window
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });
      document.addEventListener("mouseout", onOut);
      window.addEventListener("blur", onLeave);

      cleanup = () => {
        delete html.dataset.cursor;
        root.dataset.visible = "false";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
        document.removeEventListener("mouseout", onOut);
        window.removeEventListener("blur", onLeave);
        gsap.killTweensOf(ring);
      };
    };

    const sync = () => {
      cleanup?.();
      cleanup = null;
      if (mq.matches) enable();
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      cleanup?.();
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root} data-state="default" data-visible="false" aria-hidden>
      <div ref={ringRef} className={styles.ringPos}>
        <div className={styles.ring}>
          <svg className={styles.turn} viewBox="0 0 100 100">
            <path d="M22 38a32 32 0 0 1 44-20" />
            <path d="M60 10l7 8-10 4" />
            <path d="M78 62a32 32 0 0 1-44 20" />
            <path d="M40 90l-7-8 10-4" />
          </svg>
          <svg className={styles.arrow} viewBox="0 0 24 24">
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
          <span className={styles.label} data-for="grab">
            {dict.cursor.drag}
          </span>
          <span className={styles.label} data-for="drag">
            {dict.cursor.release}
          </span>
        </div>
      </div>
      <div ref={dotRef} className={styles.dot} />
    </div>
  );
}
