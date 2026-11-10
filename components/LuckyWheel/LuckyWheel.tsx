"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Dish } from "@/lib/dishes/types";
import { dishImageSrc } from "@/lib/dishes/imageSrc";
import { vibrate } from "@/lib/sound";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import { introPlaying } from "@/components/Intro/Intro";
import { indexAt, POINTER_DEG, rotationFor, TAU, WheelScene } from "./wheelScene";
import styles from "./LuckyWheel.module.css";

gsap.registerPlugin(useGSAP);

export type LuckyWheelHandle = { spin: () => void };

type Props = {
  ref?: Ref<LuckyWheelHandle>;
  className?: string;
  dishes: Dish[];
  onSpinStart?: () => void;
  /** Called every time a new dish passes the pointer while spinning. */
  onTick?: (dish: Dish) => void;
  onResult: (dish: Dish) => void;
};

/** Pointer tip position (% of the stage), just inside the rim at POINTER_DEG. */
const TIP_RADIUS = 40; // % of the stage size from center
const rad = (POINTER_DEG * Math.PI) / 180;
const TIP = {
  left: 50 + Math.cos(rad) * TIP_RADIUS,
  top: 50 - Math.sin(rad) * TIP_RADIUS,
  rotate: -(POINTER_DEG - 90), // the SVG is drawn pointing down
};

function randomInt(max: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function displayFontFamily() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
  return v || "system-ui, sans-serif";
}

/** Shared cache so photos load once, even across re-renders. */
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // keeps the WebGL texture untainted
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

export function LuckyWheel({ ref, className, dishes, onSpinStart, onTick, onResult }: Props) {
  const { locale, dict } = useI18n();
  const { sound } = useSound();

  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const sceneRef = useRef<WheelScene | null>(null);
  const spinningRef = useRef(false);
  const ringTween = useRef<gsap.core.Tween | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [spinning, setSpinning] = useState(false);

  const segments = useMemo(
    () => dishes.map((d) => ({ label: d.name[locale], emoji: d.emoji })),
    [dishes, locale],
  );
  const canSpin = dishes.length >= 2;

  // --- Scene lifecycle -------------------------------------------------------
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new WheelScene(host, displayFontFamily());
    sceneRef.current = scene;
    const ro = new ResizeObserver(([entry]) => scene.resize(entry.contentRect.width));
    ro.observe(host);
    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || spinningRef.current) return;
    scene.setSegments(segments);
    scene.render();

    let cancelled = false;
    // Redraw once the display font (with Vietnamese glyphs) is ready…
    document.fonts
      ?.load(`800 48px ${displayFontFamily()}`, "PHỞ ĂN GÌ")
      .catch(() => undefined)
      .then(() => !cancelled && sceneRef.current?.redraw());
    // …and again once the dish photos have arrived.
    Promise.all(dishes.map((d) => (d.image ? loadImage(dishImageSrc(d.image, 330)) : null))).then(
      (imgs) => !cancelled && sceneRef.current?.setImages(imgs),
    );
    return () => {
      cancelled = true;
    };
  }, [segments, dishes]);

  useEffect(() => () => void timelineRef.current?.kill(), []);

  // --- Entrance + idle ring rotation -----------------------------------------
  useGSAP(
    () => {
      ringTween.current = gsap.to(ringRef.current, {
        rotation: 360,
        duration: 14,
        ease: "none",
        repeat: -1,
        transformOrigin: "50% 50%",
      });
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const delay = introPlaying() ? 1.85 : 0.2;
        gsap.from(stageRef.current, {
          xPercent: 40,
          rotate: 120,
          opacity: 0,
          duration: 1.6,
          delay,
          ease: "expo.out",
        });
        gsap.from(pointerRef.current, {
          scale: 0,
          duration: 0.7,
          delay: delay + 0.8,
          ease: "back.out(2.2)",
        });
      });
    },
    { scope: stageRef },
  );

  const wobblePointer = () => {
    gsap.fromTo(
      pointerRef.current,
      { rotation: 22 },
      { rotation: 0, duration: 0.32, ease: "elastic.out(1.1, 0.35)", overwrite: true },
    );
  };

  // --- Spin -----------------------------------------------------------------
  /**
   * power 0..1 adds turns. windUp=false skips the little backwards wind-up —
   * used when the user already pulled the wheel back by hand.
   */
  const spin = ({ power = 0.5, windUp = true }: { power?: number; windUp?: boolean } = {}) => {
    const scene = sceneRef.current;
    if (!scene || spinningRef.current || !canSpin) return;

    spinningRef.current = true;
    setSpinning(true);
    sound.spin();
    vibrate(12);
    onSpinStart?.();
    if (ringTween.current) gsap.to(ringTween.current, { timeScale: 8, duration: 0.6 });

    const list = dishes;
    const n = list.length;
    const seg = TAU / n;
    const winner = randomInt(n);
    const jitter = (randomInt(1000) / 1000 - 0.5) * seg * 0.7;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const r0 = scene.rotation;
    const delta = (((r0 - rotationFor(winner, n, jitter)) % TAU) + TAU) % TAU;
    const turns = reduced ? 2 : 5 + randomInt(3) + Math.round(power * 3);
    const rEnd = r0 - (turns * TAU + delta); // negative = clockwise on screen

    const state = { r: r0 };
    let last = indexAt(r0, n);
    let lastR = r0;
    let lastT = performance.now();
    onTick?.(list[last]);

    const update = () => {
      scene.rotation = state.r;
      const idx = indexAt(state.r, n);
      if (idx !== last) {
        const now = performance.now();
        const velocity = Math.abs(state.r - lastR) / Math.max((now - lastT) / 1000, 0.001);
        last = idx;
        lastR = state.r;
        lastT = now;
        sound.tick(Math.min(velocity / 30, 1));
        wobblePointer();
        onTick?.(list[idx]);
      }
      scene.setBulbs(performance.now() / 1000);
      scene.render();
    };

    timelineRef.current = gsap
      .timeline({
        onComplete: () => {
          scene.setBulbs(null);
          scene.render();
          spinningRef.current = false;
          setSpinning(false);
          if (ringTween.current) gsap.to(ringTween.current, { timeScale: 1, duration: 1.2 });
          sound.win();
          vibrate([30, 50, 80]);
          onResult(list[winner]);
        },
      })
      // little wind-up backwards (unless dragged back by hand), then the real spin
      .to(state, {
        r: windUp ? r0 + 0.25 : r0,
        duration: reduced || !windUp ? 0.01 : 0.35,
        ease: "power2.out",
        onUpdate: update,
      })
      .to(state, {
        r: rEnd,
        duration: reduced ? 2 : 5.2 + randomInt(1200) / 1000,
        ease: "power4.out",
        onUpdate: update,
      });
  };

  useImperativeHandle(ref, () => ({ spin: () => spin() }));

  // --- Drag the wheel ---------------------------------------------------------
  // Grab the face and turn it with a finger or the mouse. On release:
  //  - pulled back (counter-clockwise) by about 20 degrees or more -> slingshot spin
  //  - flicked in either direction -> spin; a harder flick adds turns
  //  - a small or slow drag -> the wheel stays where it was left
  // Touch: moving along the rim rotates; moving toward/away from the center
  // scrolls the page, so the big phone wheel never traps scrolling.
  const grabRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    mode: "pending" | "rotate";
    x0: number;
    y0: number;
    angle: number;
    startRot: number;
    lastIdx: number;
    samples: { t: number; r: number }[];
  } | null>(null);

  const centerOf = () => {
    const r = stageRef.current!.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };
  /** Screen angle (math convention, y up) of a point around the wheel center. */
  const angleAt = (x: number, y: number) => {
    const { cx, cy } = centerOf();
    return Math.atan2(-(y - cy), x - cx);
  };

  const onGrabDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current;
    if (!scene || spinningRef.current || !canSpin || e.button > 0) return;
    sound.unlock();
    drag.current = {
      id: e.pointerId,
      mode: e.pointerType === "mouse" ? "rotate" : "pending",
      x0: e.clientX,
      y0: e.clientY,
      angle: angleAt(e.clientX, e.clientY),
      startRot: scene.rotation,
      lastIdx: indexAt(scene.rotation, dishes.length),
      samples: [{ t: performance.now(), r: scene.rotation }],
    };
    if (e.pointerType === "mouse") {
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.dragging = "true";
    }
  };

  const onGrabMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const scene = sceneRef.current;
    if (!d || !scene || e.pointerId !== d.id) return;

    if (d.mode === "pending") {
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      if (Math.hypot(dx, dy) < 6) return;
      // Radial vs tangential component of the motion, relative to the center.
      const { cx, cy } = centerOf();
      const len = Math.hypot(d.x0 - cx, d.y0 - cy) || 1;
      const ux = (d.x0 - cx) / len;
      const uy = (d.y0 - cy) / len;
      const radial = Math.abs(dx * ux + dy * uy);
      const tangential = Math.abs(-dx * uy + dy * ux);
      if (tangential < radial * 0.75) {
        drag.current = null; // a scroll gesture: let the page have it
        return;
      }
      d.mode = "rotate";
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.dragging = "true";
    }

    const a = angleAt(e.clientX, e.clientY);
    let delta = a - d.angle;
    if (delta > Math.PI) delta -= TAU;
    if (delta < -Math.PI) delta += TAU;
    d.angle = a;
    scene.rotation += delta;

    const now = performance.now();
    d.samples.push({ t: now, r: scene.rotation });
    while (d.samples.length > 2 && now - d.samples[0].t > 120) d.samples.shift();

    const idx = indexAt(scene.rotation, dishes.length);
    if (idx !== d.lastIdx) {
      d.lastIdx = idx;
      sound.tick(0.3);
      wobblePointer();
    }
    scene.render();
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current;
    drag.current = null;
    delete e.currentTarget.dataset.dragging;
    const scene = sceneRef.current;
    if (!d || !scene || d.mode !== "rotate" || cancelled) return;

    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    const omega = dt > 0.01 ? (last.r - first.r) / dt : 0; // rad/s, + = counter-clockwise
    const idle = performance.now() - last.t > 120; // finger stopped before release
    const pulledBack = scene.rotation - d.startRot; // + = dragged against the spin direction

    if (!idle && Math.abs(omega) > 2.5) {
      spin({ power: Math.min(Math.abs(omega) / 18, 1), windUp: false });
    } else if (pulledBack > 0.35) {
      spin({ power: Math.min(pulledBack / Math.PI, 1), windUp: false });
    }
  };

  // Block page scrolling only once a touch has turned into a wheel rotation.
  useEffect(() => {
    const el = grabRef.current;
    if (!el) return;
    const onTouchMove = (ev: TouchEvent) => {
      if (drag.current?.mode === "rotate") ev.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  return (
    <div
      ref={stageRef}
      className={`${styles.stage} ${className ?? ""}`}
      data-wheel-stage
    >
      <div className={styles.shadow} aria-hidden />
      <div ref={hostRef} className={styles.canvasHost} />
      {/* Circular hit area over the wheel face for dragging */}
      <div
        ref={grabRef}
        className={styles.grab}
        data-can-drag={canSpin && !spinning}
        onPointerDown={onGrabDown}
        onPointerMove={onGrabMove}
        onPointerUp={(e) => endDrag(e)}
        onPointerCancel={(e) => endDrag(e, true)}
        aria-hidden
      />

      <div
        className={styles.pointerAnchor}
        style={{ left: `${TIP.left}%`, top: `${TIP.top}%`, rotate: `${TIP.rotate}deg` }}
        aria-hidden
      >
        <div ref={pointerRef} className={styles.pointer}>
          <svg viewBox="0 0 36 48" width="100%" height="100%">
            <path d="M18 47 L3 9 Q18 -4 33 9 Z" fill="#1a1414" />
            <circle cx="18" cy="12" r="5" fill="#e4411f" />
          </svg>
        </div>
      </div>

      <button
        type="button"
        className={styles.spinBtn}
        onClick={() => spin()}
        disabled={!canSpin || spinning}
        data-spinning={spinning}
        aria-label={spinning ? dict.wheel.spinning : dict.wheel.spin}
      >
        <svg ref={ringRef} className={styles.ring} viewBox="0 0 200 200" aria-hidden>
          <defs>
            <path id="spin-ring" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
          </defs>
          <text>
            <textPath href="#spin-ring" textLength="500" lengthAdjust="spacing">
              {dict.wheel.ring}
            </textPath>
          </text>
        </svg>
        <span className={styles.spinLabel}>{dict.wheel.spin}</span>
      </button>
    </div>
  );
}
