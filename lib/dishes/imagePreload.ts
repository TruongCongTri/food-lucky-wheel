/**
 * Shared image preloader. Loads with CORS (needed for the wheel's canvas
 * texture) and pre-decodes, so the image appears instantly when used and never
 * decodes on the main thread in the middle of an animation.
 *
 * Use the SAME url + crossOrigin="anonymous" in <img> tags to hit this cache.
 */
const cache = new Map<string, Promise<HTMLImageElement | null>>();

export function preloadImage(url: string, timeoutMs = 8000): Promise<HTMLImageElement | null> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      let settled = false;
      const done = (v: HTMLImageElement | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      };
      // Never let a slow image hold anything up (e.g. the preload screen).
      const timer = setTimeout(() => done(null), timeoutMs);
      img.onload = () => {
        // decode() can reject (e.g. iOS with very large images) — the image is
        // still usable, so resolve either way.
        if (img.decode) img.decode().then(() => done(img), () => done(img));
        else done(img);
      };
      img.onerror = () => done(null);
      img.src = url;
    });
    cache.set(url, p);
    // Allow a retry later if it failed.
    p.then((img) => {
      if (!img) cache.delete(url);
    });
  }
  return p;
}

/** Width variants (Wikimedia thumbnail steps) used across the app. */
export const THUMB_W = 330; // wheel slices, live readout, first paint of result photos
export const LARGE_W = 500; // result photo once ready
