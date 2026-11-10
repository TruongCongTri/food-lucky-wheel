/**
 * Privacy & cookie consent (client-side record).
 *
 * Designed to satisfy the strictest common denominator of:
 *  - Vietnam: Law on Personal Data Protection 91/2025/QH15 + Decree 356/2025 —
 *    consent must be explicit, informed, specific; silence/pre-ticked boxes are
 *    not consent; it can be withdrawn at any time; sensitive data (precise
 *    location) needs separate consent.
 *  - Taiwan: Personal Data Protection Act (as amended 2025) — notice of purpose,
 *    data categories, retention, recipients and rights at collection; consent
 *    must be specific (not bundled into general terms).
 *  - EU/EEA visitors: GDPR + ePrivacy — non-essential storage needs prior opt-in;
 *    strictly necessary storage is allowed without consent but must be disclosed.
 *
 * Categories:
 *  - necessary   (always on): language cookie, this consent record, admin PIN
 *                 for the session, HTTP caching, security logs.
 *  - preferences (opt-in):    remember the sound on/off choice.
 *  - location    (opt-in):    use precise location to find places (sensitive);
 *                 the browser still asks for permission separately.
 * Bump CONSENT_VERSION when the policy changes materially → everyone is asked again.
 */
import { giveGeoConsent, hasGeoConsent, withdrawGeoConsent } from "./geoConsent";

export const CONSENT_VERSION = 1;
const KEY = "lw:consent";
const EVENT = "lw:consent-change";
export const OPEN_SETTINGS_EVENT = "lw:open-consent";

export type ConsentChoices = { preferences: boolean; location: boolean };
export type ConsentRecord = ConsentChoices & {
  v: number;
  at: string;
  /** Accepted the Terms of use and acknowledged the Privacy policy. */
  terms: true;
};

export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as ConsentRecord;
    return rec.v === CONSENT_VERSION && rec.terms ? rec : null;
  } catch {
    return null;
  }
}

export function saveConsent(choices: ConsentChoices) {
  const rec: ConsentRecord = { ...choices, v: CONSENT_VERSION, at: new Date().toISOString(), terms: true };
  try {
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* storage blocked: choices apply for this page view only */
  }
  // Location consent lives in its own record (also asked per use in the places list).
  if (choices.location) giveGeoConsent();
  else withdrawGeoConsent();
  // Withdrawing preferences: delete what we stored under that purpose.
  if (!choices.preferences) {
    try {
      localStorage.removeItem("lw:sound");
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: rec }));
}

/** Current choices (defaults: everything optional OFF until the person opts in). */
export function currentChoices(): ConsentChoices {
  const rec = readConsent();
  return { preferences: rec?.preferences ?? false, location: rec ? rec.location : hasGeoConsent() };
}

export const hasPreferenceConsent = () => readConsent()?.preferences === true;

export function onConsentChange(cb: (rec: ConsentRecord) => void) {
  const h = (e: Event) => cb((e as CustomEvent<ConsentRecord>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

/** Re-open the consent settings (footer "Cookie settings" link, Privacy page). */
export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
