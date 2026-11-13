"use client";

import { useI18n } from "@/components/Providers/I18nProvider";
import { useSound } from "@/components/Providers/SoundProvider";
import styles from "./SoundToggle.module.css";

/** Text toggle with an animated equalizer: "SOUND ▮▮▮ ON". */
export function SoundToggle() {
  const { dict } = useI18n();
  const { enabled, toggle } = useSound();
  const label = enabled ? dict.header.soundOff : dict.header.soundOn;

  return (
    <button
      type="button"
      className={styles.button}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
      data-on={enabled}
      data-sound-toggle // its own tap never auto-starts the background music
    >
      <span className={styles.eq} aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className={styles.text}>{enabled ? "ON" : "OFF"}</span>
    </button>
  );
}
