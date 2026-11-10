"use client";

import { useSyncExternalStore } from "react";

/** Desktop = wide AND landscape (portrait tablets use the phone layout). */
export const DESKTOP_MQ = "(min-width: 900px) and (min-aspect-ratio: 1/1)";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false, // server render: phone-first
  );
}
