"use client";

import { useState } from "react";
import type { Place } from "@/lib/places/types";
import { directionsUrl, formatDistance, type LatLng } from "@/lib/geo";
import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import styles from "./PlaceCard.module.css";
import { ArrowUpRight } from "@/components/Icons/Icons";

type Props = { place: Place; rank: number; origin: LatLng | null; fallbackEmoji: string };

/** Editorial list row: index, photo, name, mono metadata, actions. */
export function PlaceCard({ place, rank, origin, fallbackEmoji }: Props) {
  const { locale, dict } = useI18n();
  const { sound } = useSound();
  const [imgFailed, setImgFailed] = useState(false);
  const compact = new Intl.NumberFormat(locale, { notation: "compact" });

  return (
    <li className={styles.card} data-place-card>
      <div className={styles.top}>
        <span className={styles.rank}>{String(rank).padStart(2, "0")}</span>
        <div className={styles.thumb}>
          {place.photo && !imgFailed ? (
            // Photos are redirected to Google's CDN by /api/places/photo.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.photo} alt="" loading="lazy" decoding="async" onError={() => setImgFailed(true)} />
          ) : (
            <span className={styles.thumbFallback} aria-hidden>
              {fallbackEmoji}
            </span>
          )}
        </div>
      </div>

      <h4 className={styles.name}>{place.name}</h4>

      <dl className={styles.meta}>
        <div>
          <dt className="visually-hidden">Rating</dt>
          <dd className={styles.rating}>
            ★ {place.rating.toFixed(1)}
            <span className={styles.muted}>
              {" "}
              / {compact.format(place.ratingCount)} {dict.result.reviews}
            </span>
          </dd>
        </div>
        {place.distanceKm != null && (
          <div>
            <dt className="visually-hidden">{dict.result.away}</dt>
            <dd>{formatDistance(place.distanceKm, locale)}</dd>
          </div>
        )}
        {place.priceLevel ? (
          <div>
            <dt className="visually-hidden">Price</dt>
            <dd>{"₫".repeat(place.priceLevel)}</dd>
          </div>
        ) : null}
        {place.openNow != null && (
          <div>
            <dt className="visually-hidden">Status</dt>
            <dd className={styles.badge} data-open={place.openNow}>
              {place.openNow ? dict.result.openNow : dict.result.closed}
            </dd>
          </div>
        )}
      </dl>

      <p className={styles.address}>{place.address}</p>

      <div className={styles.actions}>
        <a
          className={styles.primary}
          href={directionsUrl(place, origin)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => sound.click()}
        >
          {dict.result.directions}
          <span className={styles.arrow} aria-hidden>
            <ArrowUpRight />
          </span>
        </a>
        <a
          className={styles.secondary}
          href={place.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => sound.click()}
        >
          {dict.result.viewOnMap}
        </a>
      </div>
    </li>
  );
}
