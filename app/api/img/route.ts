import { connection } from "next/server";

/**
 * Same-origin proxy for dish photos from Wikimedia Commons.
 *
 * Privacy: the visitor's browser only ever talks to this site — their IP
 * address / user agent are not sent to a third party (no cross-border transfer
 * from the browser, nothing to consent to for viewing photos).
 * Security: strict allow-list (https, Wikimedia hosts, Commons paths), images
 * only, size-capped — it cannot be used to fetch arbitrary or internal URLs.
 * Performance: long browser/CDN caching + a small in-memory LRU on the server.
 */
const HOSTS = new Set(["thumb.wikimedia.org", "upload.wikimedia.org"]);
const UA = "LuckyWheelWeb/1.0 (Vietnamese food wheel; image proxy)";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ENTRIES = 120;

type Entry = { body: ArrayBuffer; type: string };
const lru = new Map<string, Entry>();

function allowed(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !HOSTS.has(u.hostname)) return null;
    if (!u.pathname.startsWith("/wikipedia/commons/")) return null;
    return u;
  } catch {
    return null;
  }
}

const respond = (e: Entry) =>
  new Response(e.body, {
    headers: {
      "Content-Type": e.type,
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });

export async function GET(request: Request) {
  await connection();
  const src = allowed(new URL(request.url).searchParams.get("src"));
  if (!src) return new Response("Bad image source", { status: 400 });
  const key = src.toString();

  const hit = lru.get(key);
  if (hit) {
    lru.delete(key); // refresh recency
    lru.set(key, hit);
    return respond(hit);
  }

  const res = await fetch(key, {
    headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/*" },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return new Response(null, { status: 502 });
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return new Response(null, { status: 415 });
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return new Response(null, { status: 413 });
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response(null, { status: 413 });

  const entry = { body, type };
  lru.set(key, entry);
  if (lru.size > MAX_ENTRIES) lru.delete(lru.keys().next().value!);
  return respond(entry);
}
