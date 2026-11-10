import styles from "./Intro.module.css";

/**
 * Pure-CSS intro curtain (never blocks interaction).
 * Shown once per session: INTRO_SCRIPT runs before first paint and marks
 * <html data-intro="play"> only on the first visit. It is idempotent — if it
 * runs again it never removes the mark — and without JS the intro stays hidden.
 */
export const INTRO_SCRIPT = `try{if(!sessionStorage.getItem('lw:intro')){sessionStorage.setItem('lw:intro','1');document.documentElement.dataset.intro='play'}}catch(e){}`;

/** True while this page load is showing the intro (entrance delays wait for it). */
export const introPlaying = () =>
  typeof document !== "undefined" && document.documentElement.dataset.intro === "play";

const WORD = ["Ă", "N", " ", "G", "Ì", "?"];

export function Intro({ label }: { label: string }) {
  return (
    <div className={styles.intro} aria-hidden>
      <div className={styles.word}>
        {WORD.map((ch, i) => (
          <span key={i} className={styles.mask}>
            <span className={styles.char} style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
              {ch}
            </span>
          </span>
        ))}
      </div>
      <div className={styles.meta}>
        <span>{label}</span>
        <span className={styles.bar}>
          <span />
        </span>
      </div>
    </div>
  );
}
