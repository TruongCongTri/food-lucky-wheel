"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dish } from "@/lib/dishes/types";
import { getCurrentPosition, type LatLng } from "@/lib/geo";
import { hasGeoConsent } from "@/lib/geoConsent";
import { useI18n } from "@/components/Providers/I18nProvider";
import { LuckyWheel, type LuckyWheelHandle } from "@/components/LuckyWheel/LuckyWheel";
import { Readout, type Phase, type ReadoutHandle } from "@/components/Readout/Readout";
import { ResultSheet } from "@/components/ResultSheet/ResultSheet";
import { Confetti, type ConfettiHandle } from "@/components/Confetti/Confetti";
import { Marquee } from "@/components/Marquee/Marquee";
import { StageHeadline } from "@/components/StageHeadline/StageHeadline";
import { ResultPopup } from "@/components/ResultPopup/ResultPopup";
import { DESKTOP_MQ, useMediaQuery } from "@/lib/useMediaQuery";
import { withCurtain } from "@/components/PageTransition/PageTransition";
import styles from "./HomeExperience.module.css";

const sameDishes = (a: Dish[], b: Dish[]) =>
  a.length === b.length &&
  a.every(
    (d, i) =>
      d.id === b[i].id &&
      d.name.vi === b[i].name.vi &&
      d.name.en === b[i].name.en &&
      d.emoji === b[i].emoji &&
      d.image === b[i].image,
  );

/**
 * Home stage.
 * Desktop: an oversized wheel runs off the top, bottom and right edges; the
 *          readout on the left shows what the 160° pointer picks.
 * Phone:   headline above a big wheel (running off the right); the pick pops up.
 */
export function HomeExperience({ initialDishes }: { initialDishes: Dish[] }) {
  const { locale, dict } = useI18n();
  const [dishes, setDishes] = useState(initialDishes);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Dish | null>(null);
  const [places, setPlaces] = useState<number | null>(null);
  const [popup, setPopup] = useState<number | null>(null);
  const desktop = useMediaQuery(DESKTOP_MQ);
  const desktopRef = useRef(desktop);
  const popupReadoutRef = useRef<ReadoutHandle>(null);
  const phaseRef = useRef<Phase>("idle");
  const wheelRef = useRef<LuckyWheelHandle>(null);
  const readoutRef = useRef<ReadoutHandle>(null);
  const confettiRef = useRef<ConfettiHandle>(null);
  const locationRef = useRef<Promise<LatLng> | null>(null);

  useEffect(() => {
    desktopRef.current = desktop;
  }, [desktop]);

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // Keep the wheel in sync with management changes (routes stay mounted under
  // Cache Components, so refetch whenever the page becomes visible again).
  useEffect(() => {
    let cancelled = false;
    // Read through a function: the ref can change across the await below.
    const spinning = () => phaseRef.current === "spinning";
    const refresh = async () => {
      if (spinning() || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/dishes?active=1", { cache: "no-store" });
        const data = (await res.json()) as { dishes: Dish[] };
        if (!cancelled && !spinning()) {
          setDishes((prev) => (sameDishes(prev, data.dishes) ? prev : data.dishes));
        }
      } catch {
        /* offline – keep current list */
      }
    };
    void refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  /** Ask for location once (started as soon as the spin begins). */
  const getLocation = useCallback(() => {
    if (!locationRef.current) {
      const p = getCurrentPosition();
      p.catch(() => {
        if (locationRef.current === p) locationRef.current = null; // allow retry
      });
      locationRef.current = p;
    }
    return locationRef.current;
  }, []);

  const onResult = useCallback((dish: Dish) => {
    setResult(dish);
    go("result");
    const isDesktop = desktopRef.current;
    if (!isDesktop) setPopup(Date.now());
    // Burst from the result photo once it has rendered (side panel or popup).
    window.setTimeout(() => {
      const from = (isDesktop ? readoutRef : popupReadoutRef).current?.photoCenter();
      confettiRef.current?.burst(from ?? undefined);
    }, isDesktop ? 60 : 320);
  }, []);

  // The places list opens and closes behind the page-transition curtain,
  // so it feels like moving to (and back from) its own page.
  const openPlaces = () => withCurtain(() => setPlaces(Date.now()), dict.result.loading);
  const closePlaces = () => withCurtain(() => setPlaces(null));
  // "Spin again" from the list: also drop the old result popup (phones) under the curtain.
  const closePlacesAndSpin = () =>
    withCurtain(() => {
      setPlaces(null);
      setPopup(null);
    }).then(() => wheelRef.current?.spin());

  const marqueeItems = useMemo(
    () => dishes.map((d) => ({ label: d.name[locale], emoji: d.emoji })),
    [dishes, locale],
  );

  return (
    <div className={styles.experience}>
      <section className={styles.stage}>
        <StageHeadline className={styles.headline} canSpin={dishes.length >= 2} />
        <Readout
          ref={readoutRef}
          className={styles.readout}
          phase={phase}
          dish={result}
          canSpin={dishes.length >= 2}
          onFindPlaces={openPlaces}
          onSpinAgain={() => wheelRef.current?.spin()}
        />
        <LuckyWheel
          ref={wheelRef}
          className={styles.wheel}
          dishes={dishes}
          onSpinStart={() => {
            go("spinning");
            // Warm up location during the spin — only if the user already consented.
            if (hasGeoConsent()) void getLocation().catch(() => undefined);
          }}
          onTick={(d) => readoutRef.current?.live(d)}
          onResult={onResult}
        />
      </section>

      <Marquee items={marqueeItems} />

      <Confetti ref={confettiRef} />

      {popup && result && !desktop && (
        <ResultPopup
          key={popup}
          readoutRef={popupReadoutRef}
          dish={result}
          onClose={() => setPopup(null)}
          onFindPlaces={openPlaces}
          onSpinAgain={() => {
            setPopup(null);
            window.setTimeout(() => wheelRef.current?.spin(), 120);
          }}
        />
      )}

      {places && result && (
        <ResultSheet
          key={places}
          dish={result}
          getLocation={getLocation}
          onClose={closePlaces}
          onSpinAgain={closePlacesAndSpin}
        />
      )}
    </div>
  );
}
