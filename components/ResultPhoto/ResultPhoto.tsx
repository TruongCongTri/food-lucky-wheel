"use client";

import { useState } from "react";
import { dishImageSrc } from "@/lib/dishes/imageSrc";
import { LARGE_W, THUMB_W } from "@/lib/dishes/imagePreload";
import styles from "./ResultPhoto.module.css";

type Props = { image?: string | null; emoji: string; alt: string; className?: string };

/**
 * Dish photo that is never empty at the result moment: the small thumbnail
 * the wheel already downloaded + decoded shows immediately; the sharper
 * version (preloaded when the spin started) fades in on top once ready.
 */
export function ResultPhoto({ image, emoji, alt, className }: Props) {
  const [sharp, setSharp] = useState(false);
  if (!image) {
    return (
      <span className={`${styles.photo} ${className ?? ""}`}>
        <span className={styles.emoji} aria-hidden>
          {emoji}
        </span>
      </span>
    );
  }
  return (
    <span className={`${styles.photo} ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.img} src={dishImageSrc(image, THUMB_W)} alt={alt} crossOrigin="anonymous" decoding="sync" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.img}
        data-sharp={sharp}
        src={dishImageSrc(image, LARGE_W)}
        alt=""
        aria-hidden
        crossOrigin="anonymous"
        decoding="async"
        onLoad={() => setSharp(true)}
      />
    </span>
  );
}
