/**
 * Pick a right-sized variant of a dish photo and serve it through our own
 * origin (/api/img), so the visitor's browser never contacts Wikimedia
 * directly (privacy: no IP/user-agent sent to a third party).
 *
 * Wikimedia thumbnails only exist in fixed steps, so snap to the nearest one.
 * Photos from other hosts (entered manually by an admin) are returned as-is;
 * the Cookies & data page discloses that those load from their own host.
 */
const STEPS = [120, 250, 330, 500, 960, 1280];
const WIKIMEDIA = /^https:\/\/(?:thumb|upload)\.wikimedia\.org\/wikipedia\/commons\//;

const proxied = (url: string) => `/api/img?src=${encodeURIComponent(url)}`;

export function dishImageSrc(url: string, width: number): string {
  const m = url.match(/^(https:\/\/(?:thumb|upload)\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/)(\d+)px-([^/]+)$/);
  if (m) {
    const step = STEPS.find((s) => s >= width) ?? STEPS[STEPS.length - 1];
    return proxied(`${m[1]}${step}px-${m[3]}`);
  }
  return WIKIMEDIA.test(url) ? proxied(url) : url;
}
