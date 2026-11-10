import { FACE_FRACTION, GEO, pctOfStage, TAU, type WheelRenderer } from "./wheelMath";
import type { WheelFace } from "./wheelFace";
import styles from "./flatWheel.module.css";

const BULBS = 24;
/** Bulb ring radius as a % of the stage (on the rim tube centre). */
const BULB_RADIUS = pctOfStage(GEO.rim) / 2;
/** Peg ring radius as a % of the face. */
const PEG_RADIUS = GEO.peg * 50;

/**
 * Lightweight 2D wheel: the face canvas inside a CSS-drawn ink plate, rim,
 * marquee bulbs and pegs. No three.js — it draws on first render, so the wheel
 * is visible immediately, works without WebGL, and is the fallback whenever
 * the 3D renderer fails or loses its GPU context. Spinning is a single
 * composited CSS rotation, which stays smooth even on weak phones.
 */
export class FlatWheel implements WheelRenderer {
  readonly kind = "flat" as const;
  private root: HTMLDivElement;
  private spinner: HTMLDivElement;
  private pegLayer: HTMLDivElement;
  private bulbRing: HTMLDivElement;
  private face: WheelFace;
  private _rotation = 0;

  constructor(host: HTMLElement, face: WheelFace) {
    this.face = face;
    const div = (cls: string, parent: HTMLElement) => {
      const el = document.createElement("div");
      el.className = cls;
      parent.appendChild(el);
      return el;
    };

    this.root = div(styles.flat, host);
    this.root.setAttribute("aria-hidden", "true");
    const size = (el: HTMLElement, pct: number) => (el.style.width = el.style.height = `${pct}%`);
    size(div(styles.plate, this.root), pctOfStage(GEO.plate));
    size(div(styles.rim, this.root), pctOfStage(GEO.rim + GEO.tube));

    this.bulbRing = div(styles.bulbs, this.root);
    for (let i = 0; i < BULBS; i++) {
      const a = (i / BULBS) * TAU;
      const b = div(styles.bulb, this.bulbRing);
      b.style.width = b.style.height = `${pctOfStage(GEO.bulb)}%`;
      b.style.left = `${50 + Math.cos(a) * BULB_RADIUS}%`;
      b.style.top = `${50 - Math.sin(a) * BULB_RADIUS}%`;
    }

    this.spinner = div(styles.spinner, this.root);
    this.spinner.style.width = this.spinner.style.height = `${FACE_FRACTION * 100}%`;
    face.canvas.className = styles.face;
    this.spinner.appendChild(face.canvas);
    this.pegLayer = div(styles.pegs, this.spinner);
  }

  get rotation() {
    return this._rotation;
  }

  set rotation(value: number) {
    this._rotation = value;
    // three.js rotation is counter-clockwise-positive; CSS rotate() is clockwise.
    this.spinner.style.transform = `rotate(${-value}rad)`;
  }

  faceChanged() {
    // The canvas is on screen — nothing to upload.
  }

  setPegs(count: number) {
    this.pegLayer.replaceChildren();
    if (count < 2) return;
    const seg = TAU / count;
    for (let i = 0; i < count; i++) {
      const a = Math.PI / 2 - (i + 0.5) * seg;
      const peg = document.createElement("i");
      peg.className = styles.peg;
      peg.style.left = `${50 + Math.cos(a) * PEG_RADIUS}%`;
      peg.style.top = `${50 - Math.sin(a) * PEG_RADIUS}%`;
      this.pegLayer.appendChild(peg);
    }
  }

  setBulbs(time: number | null) {
    this.bulbRing.dataset.phase = time === null ? "" : Math.floor(time * 9) % 2 ? "b" : "a";
  }

  resize() {
    // Pure CSS sizing.
  }

  render() {
    // Transform is applied directly in the rotation setter.
  }

  show(visible: boolean) {
    this.root.dataset.hidden = visible ? "false" : "true";
    // Keep the face canvas available as the 3D texture source while hidden.
    if (visible && this.face.canvas.parentElement !== this.spinner) {
      this.spinner.insertBefore(this.face.canvas, this.pegLayer);
    }
  }

  dispose() {
    this.root.remove();
  }
}
