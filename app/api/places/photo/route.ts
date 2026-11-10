import { connection } from "next/server";

const NAME_RE = /^places\/[\w-]+\/photos\/[\w-]+$/;

/** Resolves a Places photo to its public URL without exposing the API key. */
export async function GET(request: Request) {
  await connection();
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!key || !NAME_RE.test(name)) return new Response(null, { status: 404 });

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&skipHttpRedirect=true&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) }).catch(
    () => null,
  );
  if (!res?.ok) return new Response(null, { status: 404 });
  const { photoUri } = (await res.json()) as { photoUri?: string };
  if (!photoUri) return new Response(null, { status: 404 });

  return new Response(null, {
    status: 302,
    headers: { Location: photoUri, "Cache-Control": "public, max-age=86400" },
  });
}
