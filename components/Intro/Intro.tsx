import styles from "./Intro.module.css";

/**
 * Pure-CSS intro curtain (never blocks interaction), played on every full page
 * load — opening the site, refreshing, following a link from outside.
 * In-app navigations don't reload the document, so they never replay it (the
 * PageTransition curtain covers those instead).
 *
 * INTRO_SCRIPT runs before first paint and marks <html data-intro="play">.
 * It switches to "done" when the LAST layer's animation actually ends
 * (animationend on [data-intro-last]) — not on a timer, because the CSS
 * animation only starts at first paint, which can be seconds after the script
 * runs on a slow connection or in dev; a timer would cut the curtain off
 * mid-wipe. A 10s fallback covers cases where animations never run.
 * Components mounted later (after a client navigation) then see "done" and
 * don't wait for an intro that already finished. Without JS it stays hidden.
 */
export const INTRO_SCRIPT = `(function(){var d=document.documentElement;if(d.dataset.intro)return;d.dataset.intro='play';var end=function(){d.dataset.intro='done'};document.addEventListener('animationend',function(e){var t=e.target;if(t&&t.hasAttribute&&t.hasAttribute('data-intro-last'))end()});setTimeout(end,10000)})()`;

/** True while this page load is showing the intro (entrance delays wait for it). */
export const introPlaying = () =>
  typeof document !== "undefined" && document.documentElement.dataset.intro === "play";

const WORD = ["Ă", "N", " ", "G", "Ì", "?"];

/**
 * Timeline (seconds), all CSS:
 *   0.05–0.95  letters rise in            0.10–1.10  loading bar fills
 *   1.10–1.40  label + bar slide away     1.15–1.75  letters drop out upward
 *   1.35–2.15  chili curtain wipes up     1.55–2.35  maroon layer wipes up
 */
export function Intro({ label }: { label: string }) {
  return (
    <div className={styles.intro} aria-hidden>
      <div className={styles.back} data-intro-last />
      <div className={styles.front}>
        <div className={styles.word}>
          {WORD.map((ch, i) => (
            <span key={i} className={styles.mask}>
              <span
                className={styles.char}
                style={{ animationDelay: `${0.05 + i * 0.05}s, ${1.15 + i * 0.04}s` }}
              >
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
    </div>
  );
}
