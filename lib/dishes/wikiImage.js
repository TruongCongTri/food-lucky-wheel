// @ts-check
/**
 * Find a real photo for a dish from Wikipedia / Wikimedia Commons (free, no key).
 * Plain ES-module JS so both the Next.js server and `scripts/fetch-dish-images.mjs`
 * can import it.
 */

const UA = "LuckyWheelWeb/1.0 (Vietnamese food wheel; image lookup)";

/**
 * @typedef {{ url: string; page: string }} DishImage
 * @typedef {DishImage & { title: string }} SearchHit
 */

/** @param {string} s */
const norm = (s) => s.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();

/**
 * GET a Wikimedia API URL as JSON, backing off politely when rate limited.
 * @param {string} url
 * @returns {Promise<any>}
 */
async function getJson(url) {
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (res.status !== 429 || attempt >= 3) break;
    const retryAfter = Number(res.headers.get("retry-after")) || 4 * (attempt + 1);
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 20) * 1000));
  }
  return res.ok ? res.json() : null;
}

/**
 * Lead image of the best-matching Wikipedia article.
 * @param {"vi" | "en"} lang
 * @param {string} query
 * @returns {Promise<SearchHit | null>}
 */
async function search(lang, query) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "3",
    prop: "pageimages|info",
    inprop: "url",
    piprop: "thumbnail",
    pithumbsize: "640",
    redirects: "1",
  });
  const data = await getJson(`https://${lang}.wikipedia.org/w/api.php?${params}`);
  /** @type {Array<{ index: number; title: string; fullurl?: string; thumbnail?: { source: string } }>} */
  const pages = Object.values(data?.query?.pages ?? {});
  pages.sort((a, b) => a.index - b.index);
  const hit = pages.find((p) => p.thumbnail?.source && !/\.svg/i.test(p.thumbnail.source));
  if (!hit?.thumbnail) return null;
  const url = hit.thumbnail.source.split("?")[0]; // drop tracking params
  return { url, page: hit.fullurl ?? "", title: hit.title };
}

/**
 * A Commons photo whose file name contains the exact dish name — catches
 * specific variants (e.g. "Bánh canh cá lóc") that only have a general
 * article ("Bánh canh") on Wikipedia.
 * @param {string} name
 * @returns {Promise<DishImage | null>}
 */
async function commonsPhoto(name) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `intitle:"${name}"`,
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: "640",
  });
  const data = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  /** @type {Array<{ index: number; title: string; imageinfo?: Array<{ mime?: string; url: string; thumburl?: string; descriptionurl?: string }> }>} */
  const files = Object.values(data?.query?.pages ?? {});
  files.sort((a, b) => a.index - b.index);
  const target = norm(name);
  const file = files.find(
    (f) => /^image\/(jpeg|png|webp)$/.test(f.imageinfo?.[0]?.mime ?? "") && norm(f.title).includes(target),
  );
  const info = file?.imageinfo?.[0];
  if (!info) return null;
  return { url: (info.thumburl ?? info.url).split("?")[0], page: info.descriptionurl ?? "" };
}

/** @param {SearchHit} hit @returns {DishImage} */
const strip = ({ url, page }) => ({ url, page });

/**
 * Photo for a dish, never reusing a photo another dish already has (so e.g.
 * "Bánh canh cá lóc" doesn't get the general "Bánh canh" picture).
 * 1. Vietnamese Wikipedia's best article photo, unless it's already taken.
 * 2. A Commons photo whose file name contains the exact dish name.
 * 3. English Wikipedia (skipping taken photos), then any article photo found.
 * @param {string} nameVi
 * @param {string} [nameEn]
 * @param {Iterable<string | null | undefined>} [avoid] photo URLs used by other dishes
 * @returns {Promise<DishImage | null>}
 */
export async function findDishImage(nameVi, nameEn, avoid = []) {
  const taken = new Set([...avoid].filter(Boolean));
  /** @type {SearchHit | null} */
  let fallback = null;

  try {
    const hit = await search("vi", nameVi);
    if (hit && !taken.has(hit.url)) return strip(hit);
    fallback = hit;
  } catch {
    /* try the next source */
  }

  try {
    const photo = await commonsPhoto(nameVi);
    if (photo && !taken.has(photo.url)) return photo;
  } catch {
    /* try the next source */
  }

  const attempts = /** @type {Array<["vi" | "en", string]>} */ ([["en", nameVi]]);
  if (nameEn && nameEn !== nameVi) attempts.push(["en", `${nameEn} Vietnamese dish`]);
  for (const [lang, q] of attempts) {
    try {
      const hit = await search(lang, q);
      if (hit && !taken.has(hit.url)) return strip(hit);
      fallback ??= hit;
    } catch {
      /* try the next source */
    }
  }
  return fallback ? strip(fallback) : null;
}
