"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { sound } from "@/lib/sound";
import { hasPreferenceConsent, onConsentChange } from "@/lib/consent";

const STORAGE_KEY = "lw:sound";

type SoundValue = { enabled: boolean; toggle: () => void; sound: typeof sound };
const SoundContext = createContext<SoundValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      // The choice is only remembered with "preferences" consent (lib/consent.ts).
      const saved = hasPreferenceConsent() ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved === "off") {
        sound.enabled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage
        setEnabled(false);
      }
    } catch {
      /* storage unavailable */
    }
    // Unlock the AudioContext on the very first touch (iOS).
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    // Opting in later: start remembering the current choice right away.
    const off = onConsentChange((rec) => {
      if (rec.preferences) {
        try {
          localStorage.setItem(STORAGE_KEY, sound.enabled ? "on" : "off");
        } catch {
          /* ignore */
        }
      }
    });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      off();
    };
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      sound.enabled = true; // let the toggle sound itself play when turning on
      sound.toggle(next);
      sound.enabled = next;
      // Remember it across visits only with "preferences" consent.
      if (hasPreferenceConsent()) {
        try {
          localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  return <SoundContext value={{ enabled, toggle, sound }}>{children}</SoundContext>;
}

export function useSound() {
  const ctx = use(SoundContext);
  if (!ctx) throw new Error("useSound must be used inside <SoundProvider>");
  return ctx;
}
