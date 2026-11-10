"use client";

import { openConsentSettings } from "@/lib/consent";

/** Re-opens the consent settings — withdrawing is as easy as giving consent. */
export function ConsentSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={openConsentSettings}>
      {label}
    </button>
  );
}
