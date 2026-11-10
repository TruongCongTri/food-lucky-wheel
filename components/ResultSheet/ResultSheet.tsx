"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import type { Dish } from "@/lib/dishes/types";
import type { Place, PlacesResponse } from "@/lib/places/types";
import { mapsSearchUrl, type LatLng } from "@/lib/geo";
import { giveGeoConsent, hasGeoConsent } from "@/lib/geoConsent";
import { dishImageSrc } from "@/lib/dishes/imageSrc";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import { PlaceCard } from "@/components/PlaceCard/PlaceCard";
import styles from "./ResultSheet.module.css";

gsap.registerPlugin(useGSAP, SplitText);

type Phase = "consent" | "locating" | "loading" | "done" | "denied" | "error" | "no_api_key";

type Props = {
  dish: Dish;
  /** Screen point the circular reveal grows from (the wheel's center). */
  origin: { x: number; y: number };
  getLocation: () => Promise<LatLng>;
  onClose: () => void;
  onSpinAgain: () => void;
};

/** Full-screen result takeover with a circular clip-path reveal. */
export function ResultSheet({ dish, origin, getLocation, onClose, onSpinAgain }: Props) {
  const { locale, dict } = useI18n();
  const { sound } = useSound();
  const lenis = useLenis();

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  // Location is sensitive personal data: ask in-app before the browser prompt.
  const [consented, setConsented] = useState(() => hasGeoConsent());
  const [phase, setPhase] = useState<Phase>(() => (hasGeoConsent() ? "locating" : "consent"));
  const [places, setPlaces] = useState<Place[]>([]);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [attempt, setAttempt] = useState(0);

  const name = dish.name[locale];
  const altName = dish.name[locale === "vi" ? "en" : "vi"];

  // --- Locate user, then fetch famous places for the dish --------------------
  useEffect(() => {
    if (!consented) return;
    const ac = new AbortController();
    (async () => {
      let pos: LatLng;
      try {
        pos = await getLocation();
      } catch {
        if (!ac.signal.aborted) setPhase("denied");
        return;
      }
      if (ac.signal.aborted) return;
      setUserPos(pos);
      setPhase("loading");
      try {
        const qs = new URLSearchParams({
          q: dish.searchKeyword || dish.name.vi,
          lat: String(pos.lat),
          lng: String(pos.lng),
          lang: locale,
        });
        const res = await fetch(`/api/places?${qs}`, { signal: ac.signal });
        const data = (await res.json()) as PlacesResponse;
        if (data.status === "ok") {
          setPlaces(data.places);
          setPhase("done");
        } else {
          setPhase(data.status);
        }
      } catch {
        if (!ac.signal.aborted) setPhase("error");
      }
    })();
    return () => ac.abort();
  }, [dish, locale, getLocation, attempt, consented]);

  // --- Entrance -------------------------------------------------------------
  const circle = (r: string) => `circle(${r} at ${origin.x}px ${origin.y}px)`;

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tl = gsap.timeline();
      tl.fromTo(
        rootRef.current,
        { clipPath: circle("0px") },
        { clipPath: circle("150vmax"), duration: reduced ? 0.01 : 0.9, ease: "expo.inOut" },
      );
      if (reduced) return;
      const split = SplitText.create("[data-title]", {
        type: "words,chars",
        mask: "words",
        wordsClass: "split-word",
      });
      tl.from(split.chars, { yPercent: 120, duration: 0.8, stagger: 0.03, ease: "expo.out" }, 0.45)
        .from("[data-sticker]", { scale: 0, rotate: -120, duration: 0.9, ease: "back.out(1.8)" }, 0.5)
        .from("[data-fade]", { y: 18, opacity: 0, duration: 0.6, stagger: 0.06, ease: "power3.out" }, 0.6);
      return () => split.revert();
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      if (phase !== "done" || !places.length) return;
      gsap.from("[data-place-card]", {
        y: 30,
        opacity: 0,
        stagger: 0.08,
        duration: 0.7,
        ease: "expo.out",
      });
    },
    { scope: rootRef, dependencies: [phase, places] },
  );

  const animateOut = useCallback(
    (after: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      gsap.to(rootRef.current, {
        clipPath: circle("0px"),
        duration: 0.7,
        ease: "expo.inOut",
        onComplete: after,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- origin is fixed per mount
    [],
  );

  const close = useCallback(() => {
    sound.click();
    animateOut(onClose);
  }, [animateOut, onClose, sound]);

  const spinAgain = () => {
    sound.click();
    animateOut(onSpinAgain);
  };

  // --- Scroll lock & Escape -------------------------------------------------
  useEffect(() => {
    lenis?.stop();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    scrollRef.current?.focus({ preventScroll: true });
    return () => {
      lenis?.start();
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lenis, close]);

  const retry = () => {
    sound.click();
    setPhase("locating");
    setAttempt((a) => a + 1);
  };

  const agree = () => {
    sound.click();
    giveGeoConsent();
    setPhase("locating");
    setConsented(true);
  };

  const searchUrl = mapsSearchUrl(dish.searchKeyword || dish.name.vi, userPos);
  const busy = phase === "locating" || phase === "loading";

  return (
    <div
      ref={rootRef}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
      style={{ clipPath: circle("0px") }}
    >
      <div className={styles.bar}>
        <span className={styles.barLabel}>
          <span className={styles.dot} /> {dict.result.label}
        </span>
        <button type="button" className={styles.closeBtn} onClick={close}>
          {dict.result.close}
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className={styles.scroll} data-lenis-prevent tabIndex={-1}>
        <header className={styles.hero}>
          <p className={styles.eyebrow} data-fade>
            {dict.result.youGot}
          </p>
          <h2 id="result-title" className={styles.title} data-title>
            {name}
          </h2>
          <div className={styles.heroRow}>
            <span className={styles.sticker} data-sticker aria-hidden>
              {dish.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dishImageSrc(dish.image, 330)} alt="" decoding="async" />
              ) : (
                dish.emoji
              )}
            </span>
            <div className={styles.heroSide} data-fade>
              {altName !== name && <p className={styles.alt}>{altName}</p>}
              <button type="button" className={styles.again} onClick={spinAgain}>
                {dict.result.spinAgain}
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <section className={styles.section} aria-busy={busy}>
          <div className={styles.sectionHead} data-fade>
            <h3>{dict.result.nearby}</h3>
            <span className={styles.count}>
              ({String(phase === "done" ? places.length : 0).padStart(2, "0")})
            </span>
          </div>
          <p className={styles.hint} data-fade>
            {dict.result.nearbyHint}
          </p>

          {phase === "consent" && (
            <div className={styles.consent}>
              <p className={styles.consentTitle}>
                <span className={styles.dot} /> {dict.result.consentTitle}
              </p>
              <p>{dict.result.consentBody}</p>
              <a className={styles.policyLink} href={`/${locale}/privacy`} target="_blank" rel="noopener">
                {dict.result.consentPolicy} ↗
              </a>
              <div className={styles.noticeActions}>
                <button type="button" className={styles.mapsBtn} onClick={agree}>
                  {dict.result.consentAgree}
                </button>
                <a className={styles.ghostBtn} href={searchUrl} target="_blank" rel="noopener noreferrer">
                  {dict.result.consentDecline}
                </a>
              </div>
            </div>
          )}

          {busy && (
            <>
              <p className={styles.status}>
                <span className={styles.spinner} aria-hidden />
                {phase === "locating" ? dict.result.locating : dict.result.loading}
              </p>
              <div className={styles.list}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className={styles.skeleton} />
                ))}
              </div>
            </>
          )}

          {phase === "done" && places.length > 0 && (
            <ol className={styles.list}>
              {places.map((p, i) => (
                <PlaceCard key={p.id} place={p} rank={i + 1} origin={userPos} fallbackEmoji={dish.emoji} />
              ))}
            </ol>
          )}

          {!busy && phase !== "consent" && (phase !== "done" || places.length === 0) && (
            <div className={styles.notice}>
              <p>
                {phase === "denied"
                  ? dict.result.locationDenied
                  : phase === "no_api_key"
                    ? dict.result.noApiKey
                    : phase === "error"
                      ? dict.result.error
                      : dict.result.noPlaces}
              </p>
              <div className={styles.noticeActions}>
                {(phase === "denied" || phase === "error") && (
                  <button type="button" className={styles.ghostBtn} onClick={retry}>
                    {dict.result.retryLocation}
                  </button>
                )}
                <a className={styles.mapsBtn} href={searchUrl} target="_blank" rel="noopener noreferrer">
                  {dict.result.searchOnMaps} ↗
                </a>
              </div>
            </div>
          )}

          {phase === "done" && places.length > 0 && (
            <a className={styles.moreLink} href={searchUrl} target="_blank" rel="noopener noreferrer">
              {dict.result.searchOnMaps} ↗
            </a>
          )}
        </section>
      </div>
    </div>
  );
}
