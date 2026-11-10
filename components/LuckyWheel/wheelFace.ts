import { GEO, HUB_FRACTION, TAU, VIEW_HALF } from "./wheelMath";

/**
 * The printed wheel face, drawn on a 2D canvas. Shared by both renderers:
 * the flat renderer shows this canvas directly; the 3D renderer uses it as a
 * texture. No three.js dependency.
 */

export type WheelSegment = { label: string; emoji: string };

/** Editorial palette: chili, paper, maroon, turmeric — matches the site tokens. */
const PALETTE = [
  { bg: "#e4411f", fg: "#f3ede3", shadow: true },
  { bg: "#f3ede3", fg: "#1a1414", shadow: false },
  { bg: "#6e1f2a", fg: "#f3ede3", shadow: true },
  { bg: "#f2c14e", fg: "#1a1414", shadow: false },
];

function paletteIndex(i: number, n: number) {
  const idx = i % PALETTE.length;
  // Never let the last slice share a color with the first one.
  if (n > 1 && i === n - 1 && idx === 0) return 1;
  return idx;
}

/**
 * CSS conic-gradient of the slices in their real colours (segment 0 centered
 * at 12 o'clock, clockwise) — the server-rendered silhouette shown before any
 * JavaScript runs.
 */
export function slicesGradient(n: number) {
  if (n < 1) return "conic-gradient(#e9e1d3 0 100%)";
  const seg = 360 / n;
  const stops = Array.from({ length: n }, (_, i) => {
    const c = PALETTE[paletteIndex(i, n)].bg;
    return `${c} ${(i * seg).toFixed(3)}deg ${((i + 1) * seg).toFixed(3)}deg`;
  });
  return `conic-gradient(from ${(-seg / 2).toFixed(3)}deg, ${stops.join(", ")})`;
}

export class WheelFace {
  readonly canvas: HTMLCanvasElement;
  private fontFamily: string;
  private segments: WheelSegment[] = [];
  private images: (HTMLImageElement | null)[] = [];

  constructor(fontFamily: string, size: number) {
    this.fontFamily = fontFamily;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = size;
  }

  get size() {
    return this.canvas.width;
  }

  /** Change resolution (e.g. after the wheel was resized a lot). Returns true if changed. */
  setSize(size: number) {
    if (size === this.canvas.width) return false;
    this.canvas.width = this.canvas.height = size;
    return true;
  }

  setFont(fontFamily: string) {
    this.fontFamily = fontFamily;
  }

  setSegments(segments: WheelSegment[]) {
    this.segments = segments;
  }

  /** Dish photos aligned with the segments (null → emoji fallback). */
  setImages(images: (HTMLImageElement | null)[]) {
    this.images = images;
  }

  draw() {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d")!;
    const S = canvas.width;
    const R = S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.translate(R, R);

    const items = this.segments;
    const n = items.length || 8;
    const seg = TAU / n;

    // Slices. Canvas angles run clockwise, segment 0 centered at the top.
    for (let i = 0; i < n; i++) {
      const c = -Math.PI / 2 + i * seg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, c - seg / 2, c + seg / 2);
      ctx.closePath();
      ctx.fillStyle = items.length ? PALETTE[paletteIndex(i, n)].bg : i % 2 ? "#e9e1d3" : "#f3ede3";
      ctx.fill();
    }

    // Separators
    ctx.strokeStyle = "#1a1414";
    ctx.lineWidth = S * 0.004;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i + 0.5) * seg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
    }

    // Photo (or emoji) near the rim, name running toward the hub.
    const base = Math.min(S * 0.054, seg * R * 0.32);
    const rc = R * 0.835; // photo center radius
    const d = Math.min(seg * rc * 0.7, R * 0.245); // photo diameter
    const outer = rc - d / 2 - R * 0.03; // labels start just inside the photo…
    const inner = R * ((HUB_FRACTION * VIEW_HALF) / GEO.face + 0.05); // …and stop before the hub
    for (let i = 0; i < items.length; i++) {
      const { emoji } = items[i];
      const label = items[i].label.toLocaleUpperCase();
      const { fg, shadow } = PALETTE[paletteIndex(i, n)];
      const c = -Math.PI / 2 + i * seg;
      ctx.save();
      ctx.rotate(c);

      // Photo in a paper-ringed circle. Oriented like the label below, so
      // both read upright when the slice stops at the (left-side) pointer.
      ctx.save();
      ctx.translate(rc, 0);
      ctx.rotate(Math.PI);
      const img = this.images[i];
      if (img && img.naturalWidth) {
        const side = Math.min(img.naturalWidth, img.naturalHeight); // cover-crop
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, d / 2, 0, TAU);
        ctx.clip();
        ctx.drawImage(img, sx, sy, side, side, -d / 2, -d / 2, d, d);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(0, 0, d / 2, 0, TAU);
        ctx.lineWidth = S * 0.006;
        ctx.strokeStyle = "#f3ede3";
        ctx.stroke();
      } else {
        ctx.font = `${Math.round(d * 0.62)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji, 0, 0);
      }
      ctx.restore();

      // Name: one line if it fits comfortably, else two balanced lines.
      const { lines, size } = this.layoutLabel(ctx, label, base, outer, inner, seg);
      ctx.fillStyle = fg;
      // Read from the rim toward the hub: upright at the 160° pointer.
      ctx.rotate(Math.PI);
      ctx.font = this.labelFont(size);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      if (shadow) {
        ctx.shadowColor = "rgba(26,20,20,0.35)";
        ctx.shadowBlur = S * 0.004;
        ctx.shadowOffsetY = S * 0.0012;
      }
      const lh = size * 1.02;
      lines.forEach((line, k) => {
        ctx.fillText(line, -outer, (k - (lines.length - 1) / 2) * lh + size * 0.04);
      });
      ctx.restore();
    }

    // Gloss + vignette for a printed-enamel look
    const g = ctx.createRadialGradient(0, -R * 0.25, R * 0.05, 0, 0, R);
    g.addColorStop(0, "rgba(255,255,255,0.14)");
    g.addColorStop(0.6, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(26,20,20,0.12)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  private labelFont(size: number) {
    // Condensed width, like the site's display type.
    return `800 condensed ${Math.round(size)}px ${this.fontFamily}`;
  }

  /**
   * Fit a dish name between `outer` (photo) and `inner` (hub) radii.
   * Text runs along the radius, so its height is limited by the slice's arc
   * width at the innermost point the text reaches.
   */
  private layoutLabel(
    ctx: CanvasRenderingContext2D,
    label: string,
    base: number,
    outer: number,
    inner: number,
    seg: number,
  ): { lines: string[]; size: number } {
    const maxW = outer - inner;
    const minSize = base * 0.5;
    ctx.font = this.labelFont(base);
    const width = (t: string) => ctx.measureText(t).width; // at `base` size
    // Height allowed where a line of (scaled) width w ends.
    const room = (wAtSize: number) => 2 * (outer - wAtSize) * Math.sin(seg / 2) * 0.86;

    const fit = (lines: string[]) => {
      const widest = Math.max(...lines.map(width));
      let size = Math.min(base, (base * maxW) / widest);
      const tall = lines.length * 1.04 + 0.1; // total height in "sizes"
      const h = room((widest * size) / base);
      if (tall * size > h) size = h / tall;
      return { lines, size };
    };

    const single = fit([label]);
    const words = label.split(/\s+/);
    let best = single;
    if (words.length > 1) {
      // Balanced split: minimize the longer line.
      let split = { lines: [label, ""], widest: Infinity };
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k).join(" ");
        const b = words.slice(k).join(" ");
        const widest = Math.max(width(a), width(b));
        if (widest < split.widest) split = { lines: [a, b], widest };
      }
      const double = fit(split.lines);
      // Prefer one line unless two lines are clearly bigger.
      if (double.size > single.size * 1.15) best = double;
    }

    if (best.size >= minSize) return best;
    // Last resort: minimum size + ellipsis on the longest line.
    ctx.font = this.labelFont(minSize);
    const lines = best.lines.map((line) => {
      let t = line;
      while (ctx.measureText(t).width > maxW && t.length > 2) t = t.slice(0, -2) + "…";
      return t;
    });
    return { lines, size: minSize };
  }
}
