"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Dish } from "@/lib/dishes/types";
import { dishImageSrc } from "@/lib/dishes/imageSrc";
import { preloadImage, THUMB_W } from "@/lib/dishes/imagePreload";
import { vibrate } from "@/lib/sound";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import { introActive, onIntroDone, onIntroExit } from "@/components/Intro/Intro";
import { openGate } from "@/lib/appReady";
import { FACE_FRACTION, GEO, indexAt, pctOfStage, POINTER_DEG, rotationFor, TAU, type WheelRenderer } from "./wheelMath";
import { slicesGradient, WheelFace } from "./wheelFace";
import { FlatWheel } from "./flatWheel";
import styles from "./LuckyWheel.module.css";

gsap.registerPlugin(useGSAP);

export type LuckyWheelHandle = { spin: () => void };

type Props = {
  ref?: Ref<LuckyWheelHandle>;
  className?: string;
  dishes: Dish[];
  /** Called when a spin starts, with the (secret) winner — lets the page preload its photo. */
  onSpinStart?: (winner: Dish) => void;
  /** Called every time a new dish passes the pointer while spinning. */
  onTick?: (dish: Dish) => void;
  onResult: (dish: Dish) => void;
};

/** Pointer tip position (% of the stage), just inside the face edge at POINTER_DEG. */
const TIP_RADIUS = pctOfStage(GEO.face) / 2 - 2.2; // % of the stage size from center
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

/**
 * Device hints for progressive enhancement.
 * `?wheel=flat` / `?wheel=3d` force a renderer (support & testing).
 */
function deviceHints() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const pref = new URLSearchParams(window.location.search).get("wheel");
  const tooWeak = mem <= 2 || cores <= 2 || Boolean(nav.connection?.saveData);
  return {
    lowEnd: mem <= 4 || cores <= 4,
    force3D: pref === "3d",
    use3D: pref === "3d" || (pref !== "flat" && !tooWeak),
  };
}

/** Face resolution ≈ 1:1 with the displayed face (capped), instead of a fixed 2048². */
function faceSizeFor(stagePx: number, lowEnd: boolean) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.round(stagePx * FACE_FRACTION * dpr);
  return Math.max(512, Math.min(px, lowEnd ? 1024 : 2048));
}

/** Run when the main thread is free (with a deadline); returns a cancel function. */
function whenIdle(fn: () => void, timeout: number) {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(fn, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  // (Safari < 16.4 has no requestIdleCallback.)
  const id = setTimeout(fn, Math.min(timeout, 1200));
  return () => clearTimeout(id);
}

export function LuckyWheel({ ref, className, dishes, onSpinStart, onTick, onResult }: Props) {
  const { locale, dict } = useI18n();
  const { sound } = useSound();

  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const silhouetteRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  /** The active renderer: the 2D wheel first, the 3D one once it has loaded. */
  const rendererRef = useRef<WheelRenderer | null>(null);
  const faceRef = useRef<WheelFace | null>(null);
  const redrawTimer = useRef<number | undefined>(undefined);
  const spinningRef = useRef(false);
  const ringTween = useRef<gsap.core.Tween | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [spinning, setSpinning] = useState(false);

  const segments = useMemo(
    () => dishes.map((d) => ({ label: d.name[locale], emoji: d.emoji })),
    [dishes, locale],
  );
  const canSpin = dishes.length >= 2;
  const segmentsRef = useRef(segments);

  /** Coalesce face redraws (font loaded, photos arriving) into one paint/upload. */
  const scheduleRedraw = useCallback((delay = 0) => {
    if (redrawTimer.current !== undefined) return;
    redrawTimer.current = window.setTimeout(() => {
      requestAnimationFrame(() => {
        redrawTimer.current = undefined;
        const face = faceRef.current;
        if (!face) return;
        face.draw();
        rendererRef.current?.faceChanged();
      });
    }, delay);
  }, []);

  // --- Renderer lifecycle -----------------------------------------------------
  // 1. Draw the 2D wheel immediately — no three.js, visible on first render.
  // 2. When the page is idle, load the 3D renderer (code-split) and cross-fade.
  // 3. If 3D can't start, or its GPU context is lost later, stay on / return to 2D.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const hints = deviceHints();
    const face = new WheelFace(displayFontFamily(), faceSizeFor(host.clientWidth || 600, hints.lowEnd));
    faceRef.current = face;
    face.setSegments(segmentsRef.current);
    face.draw();
    const flat = new FlatWheel(host, face);
    flat.setPegs(segmentsRef.current.length);
    rendererRef.current = flat;
    performance.mark("wheel:drawn");
    // The real wheel is drawn exactly over the server-rendered silhouette.
    if (silhouetteRef.current) silhouetteRef.current.dataset.hidden = "true";

    let gl: WheelRenderer | null = null;
    let disposed = false;

    const fallBackToFlat = () => {
      if (!gl) return;
      flat.rotation = gl.rotation;
      flat.setPegs(segmentsRef.current.length);
      flat.show(true);
      rendererRef.current = flat;
      const dead = gl;
      gl = null;
      window.setTimeout(() => dead.dispose(), 500);
    };

    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const want = faceSizeFor(w, hints.lowEnd);
      if (Math.abs(want - face.size) / face.size > 0.25 && face.setSize(want)) {
        face.draw();
        gl?.faceChanged();
      }
      gl?.resize(w);
    });
    ro.observe(host);

    let cancelIdle = () => {};
    const upgrade = async () => {
          try {
            const { WheelScene } = await import("./wheelScene");
            if (disposed) return;
            const scene = new WheelScene(host, face, {
              lowEnd: hints.lowEnd,
              force: hints.force3D,
              onLost: fallBackToFlat,
            });
            scene.rotation = flat.rotation;
            scene.setPegs(segmentsRef.current.length);
            scene.resize(host.clientWidth);
            gl = scene;
            rendererRef.current = scene;
            scene.show(true);
            flat.show(false);
            performance.mark("wheel:3d");
          } catch {
            // No WebGL2, software-only GPU, or out of memory: keep the 2D wheel.
          }
        };
    // Upgrade to 3D only after the preload curtain has fully gone (parsing
    // three.js mid-exit would stutter it), and then only when the page is idle.
    const cancelIntroWait = hints.use3D
      ? onIntroDone(() => {
          cancelIdle = whenIdle(upgrade, 2500);
        })
      : () => {};
    const cancelUpgrade = () => {
      cancelIntroWait();
      cancelIdle();
    };

    return () => {
      disposed = true;
      cancelUpgrade();
      ro.disconnect();
      window.clearTimeout(redrawTimer.current);
      redrawTimer.current = undefined;
      gl?.dispose();
      flat.dispose();
      rendererRef.current = null;
      faceRef.current = null;
    };
  }, []);

  useEffect(() => {
    segmentsRef.current = segments;
    const face = faceRef.current;
    const r = rendererRef.current;
    if (!face || !r || spinningRef.current) return;
    face.setSegments(segments);
    face.setImages([]);
    face.draw();
    r.setPegs(segments.length);
    r.faceChanged();
    r.render();

    let cancelled = false;
    // Redraw once the display font (with Vietnamese glyphs) is ready…
    document.fonts
      ?.load(`800 48px ${displayFontFamily()}`, "PHỞ ĂN GÌ")
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        face.setFont(displayFontFamily());
        scheduleRedraw();
      });
    // …and fetch dish photos after first paint, adding each as it arrives
    // (redraws are batched, so N photos don't mean N texture uploads).
    const images: (HTMLImageElement | null)[] = dishes.map(() => null);
    // Same 330px variant everywhere (wheel, live readout, result first paint),
    // so it's downloaded and decoded once.
    const loadPhotos = () =>
      Promise.all(
        dishes.map((d, i) =>
          d.image
            ? preloadImage(dishImageSrc(d.image, THUMB_W)).then((img) => {
                if (cancelled || !img) return;
                images[i] = img;
                face.setImages([...images]);
                scheduleRedraw(200);
              })
            : null,
        ),
      );
    let cancelPhotos = () => {};
    if (introActive()) {
      // Under the preload curtain: fetch now, and open the "wheel" ready gate
      // once the face is drawn with every photo (each photo is capped by the
      // preloader's timeout; the gate itself by the curtain's).
      void loadPhotos().then(() => {
        if (cancelled) return;
        face.draw();
        rendererRef.current?.faceChanged();
        performance.mark("wheel:photos");
        openGate("wheel");
      });
    } else {
      cancelPhotos = whenIdle(() => void loadPhotos(), 1500);
    }
    return () => {
      cancelled = true;
      cancelPhotos();
    };
  }, [segments, dishes, scheduleRedraw]);

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
        // Animate in only behind the preload curtain, starting as it lifts. If
        // hydration finished after the curtain was gone (slow phones), the
        // server-rendered wheel is already on screen — re-animating would flicker.
        if (!introActive()) return;
        const stage = gsap.from(stageRef.current, {
          xPercent: 40,
          rotate: 120,
          opacity: 0,
          duration: 1.6,
          ease: "expo.out",
          paused: true,
        });
        const pointer = gsap.from(pointerRef.current, {
          scale: 0,
          duration: 0.7,
          ease: "back.out(2.2)",
          paused: true,
        });
        return onIntroExit((delay) => {
          gsap.delayedCall(delay, () => void stage.play());
          gsap.delayedCall(delay + 0.8, () => void pointer.play());
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
    const scene = rendererRef.current;
    if (!scene || spinningRef.current || !canSpin) return;

    spinningRef.current = true;
    setSpinning(true);
    sound.spin();
    vibrate(12);
    if (ringTween.current) gsap.to(ringTween.current, { timeScale: 8, duration: 0.6 });

    const list = dishes;
    const n = list.length;
    const seg = TAU / n;
    const winner = randomInt(n);
    // Tell the page the winner now, ~5s before it's revealed, so its photo can preload.
    onSpinStart?.(list[winner]);
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
      // The 3D renderer may replace the 2D one mid-spin — always use the current one.
      const scene = rendererRef.current;
      if (!scene) return;
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
          rendererRef.current?.setBulbs(null);
          rendererRef.current?.render();
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
    const scene = rendererRef.current;
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
    const scene = rendererRef.current;
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
    const scene = rendererRef.current;
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
      data-ready-gate="wheel"
    >
      <div className={styles.shadow} aria-hidden />
      {/* Visible at first paint, before any JavaScript: ink plate + slices. */}
      <div
        ref={silhouetteRef}
        className={styles.silhouette}
        style={{
          ["--slices" as string]: slicesGradient(dishes.length),
          // same geometry as the real wheel (wheelMath.ts)
          ["--plate" as string]: `${pctOfStage(GEO.plate)}%`,
          ["--face-inset" as string]: `${((GEO.plate - GEO.face) / (2 * GEO.plate)) * 100}%`,
        }}
        aria-hidden
      />
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
