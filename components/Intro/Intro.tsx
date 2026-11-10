import styles from "./Intro.module.css";

/**
 * First-load preload curtain, played on every full page load.
 *
 * While it shows, the app loads in the background (brand font, and on the home
 * page the wheel with all its dish photos). It lifts as soon as that is ready —
 * but never before the title has finished rising (MIN) and never later than
 * MAX, so it can't feel frozen. Several independent safety nets guarantee it
 * can't get stuck (important on iPhone):
 *   1. HARD timer in this inline script (runs even if React never hydrates);
 *   2. a pure-CSS failsafe animation that hides the curtain at 9s, even if all
 *      JavaScript dies (Intro.module.css);
 *   3. iOS/Safari back-forward cache: a page restored mid-intro is ended at once;
 *   4. every readiness task has its own timeout (lib/appReady.ts) — e.g.
 *      document.fonts or image decode can stall on iOS.
 * The progress bar eases forward on its own and jumps as tasks complete, so it
 * always moves. States on <html data-intro>: "play" → "exit" → "done".
 * (ES5, no template syntax: it is inlined into <head> before first paint.)
 */
export const INTRO_SCRIPT = `(function(){
var d=document.documentElement;if(d.dataset.intro)return;
var reduce=false;try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
if(reduce){d.dataset.intro='done';return}
d.dataset.intro='play';
var MIN=1400,MAX=4000,HARD=7000,paint=0,ready=false,exited=false,finished=false,tasksDone=0,tasksTotal=0,bar=null;
function fire(n){try{window.dispatchEvent(new Event(n))}catch(e){}}
function setBar(p){if(!bar)bar=document.querySelector('[data-intro-bar]');if(bar)bar.style.transform='scaleX('+p+')'}
function exit(){if(exited)return;exited=true;setBar(1);d.dataset.intro='exit';fire('intro:exit')}
function done(){if(finished)return;finished=true;exited=true;d.dataset.intro='done';fire('intro:done')}
function tick(now){if(exited)return;if(!paint){paint=now;setTimeout(exit,MAX)}var t=now-paint;
var timeP=0.85*(1-Math.exp(-t/1400)),taskP=tasksTotal?0.95*tasksDone/tasksTotal:0;
setBar(Math.max(timeP,taskP).toFixed(3));
if((ready&&t>=MIN)||t>=MAX){exit();return}
requestAnimationFrame(tick)}
requestAnimationFrame(tick);
setTimeout(exit,HARD);setTimeout(done,HARD+2500);
window.__intro={ready:function(){ready=true},progress:function(a,b){tasksDone=a;tasksTotal=b}};
document.addEventListener('animationend',function(e){var x=e.target;if(x&&x.hasAttribute&&x.hasAttribute('data-intro-last'))done()});
window.addEventListener('pageshow',function(e){if(e.persisted)done()});
})()`;

const intro = () => (typeof document === "undefined" ? undefined : document.documentElement.dataset.intro);

/** True while the preload curtain is up (the app is still getting ready). */
export const introActive = () => intro() === "play";

/** Kept for existing callers: the curtain is up or lifting. */
export const introPlaying = () => intro() === "play" || intro() === "exit";

/** Seconds after the curtain starts lifting until entrance animations should start. */
const REVEAL_DELAY = 0.5;

/**
 * Run `cb(delay)` when the curtain starts to lift — for entrance animations.
 * Never called if the intro already finished (content is already on screen).
 * Returns a cancel function.
 */
export function onIntroExit(cb: (delay: number) => void): () => void {
  const state = intro();
  if (state === "exit") {
    const id = setTimeout(() => cb(0.2), 0);
    return () => clearTimeout(id);
  }
  if (state !== "play") return () => {};
  let fired = false;
  const run = () => {
    if (fired) return;
    fired = true;
    cb(REVEAL_DELAY);
  };
  window.addEventListener("intro:exit", run, { once: true });
  const safety = setTimeout(run, 9000); // never leave content hidden
  return () => {
    window.removeEventListener("intro:exit", run);
    clearTimeout(safety);
  };
}

/** Run `cb` once the curtain has fully gone (or right away if there is none). */
export function onIntroDone(cb: () => void): () => void {
  const state = intro();
  if (state !== "play" && state !== "exit") {
    const id = setTimeout(cb, 0);
    return () => clearTimeout(id);
  }
  let fired = false;
  const run = () => {
    if (fired) return;
    fired = true;
    cb();
  };
  window.addEventListener("intro:done", run, { once: true });
  const safety = setTimeout(run, 12000);
  return () => {
    window.removeEventListener("intro:done", run);
    clearTimeout(safety);
  };
}

const WORD = ["Ă", "N", " ", "G", "Ì", "?"];

export function Intro({ label, message }: { label: string; message: string }) {
  return (
    <div className={styles.intro} aria-hidden>
      <div className={styles.back} data-intro-last />
      <div className={styles.front}>
        <p className={styles.message}>{message}</p>
        <div className={styles.word}>
          {WORD.map((ch, i) => (
            <span key={i} className={styles.mask}>
              <span
                className={styles.char}
                style={{ ["--rise" as string]: `${0.05 + i * 0.05}s`, ["--out" as string]: `${i * 0.04}s` }}
              >
                {ch}
              </span>
            </span>
          ))}
        </div>
        <div className={styles.meta}>
          <span>{label}</span>
          <span className={styles.bar}>
            <span data-intro-bar />
          </span>
        </div>
      </div>
    </div>
  );
}
