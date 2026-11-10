/**
 * Coarse device-capability hints, used to scale down effects on weak/old
 * phones. Safe to call only in the browser.
 */
type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

/** ≤ 4 GB RAM or ≤ 4 CPU cores (most budget/older Android phones, older iPhones report cores only). */
export function isLowEndDevice(): boolean {
  const nav = navigator as Nav;
  return (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
