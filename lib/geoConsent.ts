/**
 * Explicit, prior consent for processing precise location (treated as sensitive
 * personal data under Vietnam's Law on Personal Data Protection 91/2025/QH15).
 * The record lives only on the user's device. Bump CONSENT_VERSION when the
 * privacy policy's location section changes materially, so users are asked again.
 */
const KEY = "lw:geo-consent";
export const CONSENT_VERSION = 1;

type ConsentRecord = { v: number; at: string };

export function hasGeoConsent(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as ConsentRecord).v === CONSENT_VERSION;
  } catch {
    return false;
  }
}

export function giveGeoConsent() {
  try {
    const record: ConsentRecord = { v: CONSENT_VERSION, at: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable: consent applies to this session only */
  }
}

export function withdrawGeoConsent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function geoConsentDate(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ConsentRecord).at : null;
  } catch {
    return null;
  }
}
