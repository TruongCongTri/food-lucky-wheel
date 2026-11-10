import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type WheelSegment = { label: string; emoji: string };

export const TAU = Math.PI * 2;

/** Spin button width as a fraction of the stage (keep in sync with LuckyWheel.module.css). */
export const HUB_FRACTION = 0.2;
/** Half the visible width at the wheel plane, in world units (camera z 4.6, fov 30°). */
const VIEW_HALF = 4.6 * Math.tan((15 * Math.PI) / 180);

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

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Pointer position, in degrees counter-clockwise from 3 o'clock (math convention).
 * 160° sits on the left of the wheel, just above center, pointing at the result.
 */
export const POINTER_DEG = 160;
const POINTER_ANGLE = (POINTER_DEG * Math.PI) / 180;
/** Rotation at which segment 0 (drawn at 12 o'clock) sits under the pointer. */
const POINTER_OFFSET = POINTER_ANGLE - Math.PI / 2;

/**
 * Which segment sits under the pointer for a given spinner rotation.
 * Segment i is drawn centered at angle (π/2 − i·seg); it reaches the pointer
 * when rotation ≡ POINTER_OFFSET + i·seg (mod 2π).
 */
export function indexAt(rotation: number, n: number) {
  if (n <= 0) return -1;
  return mod(Math.round((rotation - POINTER_OFFSET) / (TAU / n)), n);
}

/** Rotation (mod 2π) that puts segment `index` under the pointer, plus jitter. */
export function rotationFor(index: number, n: number, jitter = 0) {
  return POINTER_OFFSET + index * (TAU / n) + jitter;
}

/**
 * Three.js lucky wheel. Rendering is on-demand (no idle rAF loop) —
 * the owner calls `render()` while animating, which keeps mobile batteries happy.
 * Falls back to a rotating 2D canvas when WebGL isn't available.
 */
export class WheelScene {
  readonly mode: "webgl" | "2d";
  readonly faceCanvas: HTMLCanvasElement;

  private fontFamily: string;
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private spinner?: THREE.Group;
  private texture?: THREE.CanvasTexture;
  private pegs?: THREE.Group;
  private pegGeo?: THREE.SphereGeometry;
  private pegMat?: THREE.MeshStandardMaterial;
  private bulbMats: THREE.MeshStandardMaterial[] = [];
  private envTarget?: THREE.WebGLRenderTarget;
  private disposables: { dispose(): void }[] = [];
  private _rotation = 0;
  private segments: WheelSegment[] = [];
  private images: (HTMLImageElement | null)[] = [];

  constructor(host: HTMLElement, fontFamily: string) {
    this.fontFamily = fontFamily;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.faceCanvas = document.createElement("canvas");
    // The wheel is drawn very large (up to ~1.5× the screen), so keep the face crisp.
    this.faceCanvas.width = this.faceCanvas.height = 2048;

    let renderer: THREE.WebGLRenderer | undefined;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      renderer = undefined;
    }

    if (!renderer) {
      this.mode = "2d";
      this.faceCanvas.setAttribute("aria-hidden", "true");
      this.faceCanvas.style.cssText =
        "width:88%;height:88%;margin:6%;border-radius:50%;border:10px solid #1a1414;box-sizing:border-box;";
      host.appendChild(this.faceCanvas);
      return;
    }

    this.mode = "webgl";
    this.renderer = renderer;
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;";
    host.appendChild(renderer.domElement);

    renderer.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
    renderer.domElement.addEventListener("webglcontextrestored", () => this.render());

    this.build();
  }

  private build() {
    const renderer = this.renderer!;
    const scene = (this.scene = new THREE.Scene());

    // Soft studio reflections for the gold rim.
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = this.envTarget.texture;
    pmrem.dispose();

    const camera = (this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50));
    camera.position.set(0, 0, 4.6);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.4);
    key.position.set(-2, 3, 5);
    scene.add(key);

    // Root is tilted slightly for depth; the spinner rotates inside it.
    // Turned slightly toward the viewer on the left (pointer side), since the
    // right side of the wheel runs off-screen.
    const root = new THREE.Group();
    root.rotation.y = 0.16;
    root.rotation.x = -0.04;
    scene.add(root);

    // Back plate
    const backGeo = new THREE.CylinderGeometry(1.14, 1.14, 0.16, 128);
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x1a1414,
      roughness: 0.35,
      metalness: 0.2,
      envMapIntensity: 0.25,
    });
    const back = new THREE.Mesh(backGeo, backMat);
    back.rotation.x = Math.PI / 2;
    back.position.z = -0.09;
    root.add(back);

    // Ink-lacquer rim (glossy black, catches the studio reflections)
    const rimGeo = new THREE.TorusGeometry(1.045, 0.062, 32, 180);
    const rimMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1414,
      metalness: 0.1,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.28, // keep it reading as ink, not chrome
    });
    root.add(new THREE.Mesh(rimGeo, rimMat));

    // Marquee bulbs on the rim (alternate between two materials to blink).
    const bulbGeo = new THREE.SphereGeometry(0.03, 16, 12);
    const bulbA = new THREE.MeshStandardMaterial({
      color: 0xf3ede3,
      emissive: 0xf2c14e,
      emissiveIntensity: 0.15,
      roughness: 0.4,
    });
    const bulbB = bulbA.clone();
    this.bulbMats = [bulbA, bulbB];
    const BULBS = 24;
    for (let i = 0; i < BULBS; i++) {
      const a = (i / BULBS) * TAU;
      const bulb = new THREE.Mesh(bulbGeo, i % 2 ? bulbB : bulbA);
      bulb.position.set(Math.cos(a) * 1.045, Math.sin(a) * 1.045, 0.062);
      root.add(bulb);
    }

    // Spinner: printed face + pegs
    const spinner = (this.spinner = new THREE.Group());
    root.add(spinner);

    const texture = (this.texture = new THREE.CanvasTexture(this.faceCanvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const faceGeo = new THREE.CircleGeometry(1, 160);
    const faceMat = new THREE.MeshBasicMaterial({ map: texture });
    spinner.add(new THREE.Mesh(faceGeo, faceMat));

    this.pegGeo = new THREE.SphereGeometry(0.024, 16, 12);
    this.pegMat = new THREE.MeshStandardMaterial({
      color: 0x1a1414,
      metalness: 0.3,
      roughness: 0.25,
    });
    this.pegs = new THREE.Group();
    spinner.add(this.pegs);

    this.disposables.push(
      backGeo,
      backMat,
      rimGeo,
      rimMat,
      bulbGeo,
      bulbA,
      bulbB,
      texture,
      faceGeo,
      faceMat,
      this.pegGeo,
      this.pegMat,
    );
  }

  get rotation() {
    return this._rotation;
  }

  set rotation(value: number) {
    this._rotation = value;
    if (this.spinner) this.spinner.rotation.z = value;
    else this.faceCanvas.style.transform = `rotate(${-value}rad)`;
  }

  setSegments(segments: WheelSegment[]) {
    this.segments = segments;
    this.drawFace();
    if (this.texture) this.texture.needsUpdate = true;
    this.buildPegs();
  }

  /** Dish photos aligned with the segments (null → emoji fallback). */
  setImages(images: (HTMLImageElement | null)[]) {
    this.images = images;
    this.redraw();
  }

  /** Redraw the face, e.g. after the web font has loaded. */
  redraw() {
    this.setSegments(this.segments);
    this.render();
  }

  private buildPegs() {
    if (!this.pegs) return;
    this.pegs.clear();
    const n = this.segments.length;
    if (n < 2) return;
    const seg = TAU / n;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 - (i + 0.5) * seg;
      const peg = new THREE.Mesh(this.pegGeo, this.pegMat);
      peg.position.set(Math.cos(a) * 0.955, Math.sin(a) * 0.955, 0.024);
      this.pegs.add(peg);
    }
  }

  private drawFace() {
    const canvas = this.faceCanvas;
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
      ctx.fillStyle = items.length
        ? PALETTE[paletteIndex(i, n)].bg
        : i % 2
          ? "#e9e1d3"
          : "#f3ede3";
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
    const inner = R * (HUB_FRACTION * VIEW_HALF + 0.05); // …and stop before the hub
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

  /** Blink the marquee bulbs; pass null to return to the idle glow. */
  setBulbs(time: number | null) {
    if (!this.bulbMats.length) return;
    const [a, b] = this.bulbMats;
    if (time === null) {
      a.emissiveIntensity = b.emissiveIntensity = 0.15;
      return;
    }
    const on = Math.floor(time * 9) % 2 === 0;
    a.emissiveIntensity = on ? 2.2 : 0.1;
    b.emissiveIntensity = on ? 0.1 : 2.2;
  }

  resize(size: number) {
    if (!this.renderer || size <= 0) return;
    this.renderer.setSize(size, size, false);
    this.render();
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.envTarget?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    } else {
      this.faceCanvas.remove();
    }
  }
}
