/**
 * Pure wheel geometry — no three.js here, so it stays in the small, eagerly
 * loaded bundle (the 3D renderer is code-split and loaded later).
 */

export const TAU = Math.PI * 2;

/** Spin button width as a fraction of the stage (keep in sync with LuckyWheel.module.css). */
export const HUB_FRACTION = 0.2;
/** Half the visible width at the wheel plane, in world units (camera z 4.6, fov 30°). */
export const VIEW_HALF = 4.6 * Math.tan((15 * Math.PI) / 180);

/**
 * Wheel geometry in world units — the single source of truth for the 3D scene,
 * the 2D wheel, the server-rendered silhouette and the pointer position.
 * A slim rim (tube 0.026, was 0.062) leaves more room for the printed face.
 */
export const GEO = {
  face: 1.07, // printed face radius (was 1.0)
  rim: 1.093, // rim tube centre
  tube: 0.026, // rim tube radius
  plate: 1.122, // ink back plate radius
  bulb: 0.017, // marquee bulb radius
  peg: 0.955, // peg ring, as a fraction of the face radius
} as const;

/** Face diameter as a fraction of the stage width. */
export const FACE_FRACTION = GEO.face / VIEW_HALF;
/** World radius → % of the stage width (for CSS sizing). */
export const pctOfStage = (r: number) => (r / VIEW_HALF) * 100;

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

/** What both renderers (flat 2D and 3D) expose to the wheel component. */
export interface WheelRenderer {
  readonly kind: "flat" | "webgl";
  rotation: number;
  /** Re-render after the face canvas changed (new texture upload in 3D). */
  faceChanged(): void;
  setPegs(count: number): void;
  setBulbs(time: number | null): void;
  resize(size: number): void;
  render(): void;
  show(visible: boolean): void;
  dispose(): void;
}
