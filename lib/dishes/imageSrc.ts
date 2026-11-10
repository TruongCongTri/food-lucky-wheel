/**
 * Pick a right-sized variant of a dish photo.
 * Wikimedia thumbnails only exist in fixed steps, so snap to the nearest one;
 * any other URL is returned unchanged.
 */
const STEPS = [120, 250, 330, 500, 960, 1280];

export function dishImageSrc(url: string, width: number): string {
  const m = url.match(/^(https:\/\/(?:thumb|upload)\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/)(\d+)px-([^/]+)$/);
  if (!m) return url;
  const step = STEPS.find((s) => s >= width) ?? STEPS[STEPS.length - 1];
  return `${m[1]}${step}px-${m[3]}`;
}
