import { connection } from "next/server";
import { distanceKm } from "@/lib/geo";
import type { Place, PlacesResponse } from "@/lib/places/types";

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
  photos?: { name: string }[];
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "places.photos",
  "places.priceLevel",
  "places.currentOpeningHours.openNow",
  "places.googleMapsUri",
].join(",");

const PRICE: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const json = (body: PlacesResponse, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": status === 200 ? "private, max-age=300" : "no-store",
    },
  });

/**
 * GET /api/places?q=Phở bò&lat=10.77&lng=106.70&lang=vi
 * Famous, highly rated places serving a dish near the user
 * (Google Places API – New, Text Search). The API key never leaves the server.
 */
export async function GET(request: Request) {
  await connection();
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return json({ status: "no_api_key", places: [] });

  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 60);
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const lang = sp.get("lang") === "en" ? "en" : "vi";
  const origin =
    sp.has("lat") && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;
  if (!q) return json({ status: "error", places: [] }, 400);

  const body: Record<string, unknown> = {
    textQuery: q,
    languageCode: lang,
    minRating: 4,
    pageSize: 20,
    rankPreference: "RELEVANCE",
  };
  if (origin) {
    body.locationBias = {
      circle: {
        center: { latitude: origin.lat, longitude: origin.lng },
        radius: 5000,
      },
    };
  }

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) {
      console.error("[places] Google responded", res.status, await res.text());
      return json({ status: "error", places: [] }, 502);
    }
    const data = (await res.json()) as { places?: GooglePlace[] };

    const places: Place[] = (data.places ?? [])
      .filter((p) => p.location && p.displayName?.text)
      .map((p) => {
        const loc = { lat: p.location!.latitude, lng: p.location!.longitude };
        const photoName = p.photos?.[0]?.name;
        return {
          id: p.id,
          name: p.displayName!.text,
          address: p.formattedAddress ?? "",
          rating: p.rating ?? 0,
          ratingCount: p.userRatingCount ?? 0,
          lat: loc.lat,
          lng: loc.lng,
          distanceKm: origin ? distanceKm(origin, loc) : null,
          openNow: p.currentOpeningHours?.openNow ?? null,
          mapsUrl:
            p.googleMapsUri ??
            `https://www.google.com/maps/place/?q=place_id:${p.id}`,
          photo: photoName
            ? `/api/places/photo?name=${encodeURIComponent(photoName)}`
            : null,
          priceLevel: p.priceLevel ? (PRICE[p.priceLevel] ?? null) : null,
        };
      })
      // "Famous": enough reviews to trust the rating.
      .filter((p) => p.ratingCount >= 20)
      .map((p) => ({ p, score: rank(p) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ p }) => p);

    return json({ status: "ok", places });
  } catch (err) {
    console.error("[places]", err);
    return json({ status: "error", places: [] }, 502);
  }
}

/** Blend quality, popularity and proximity. */
function rank(p: Place): number {
  const popularity = Math.log10(p.ratingCount + 10);
  const proximity = p.distanceKm == null ? 1 : 1 / (1 + p.distanceKm * 0.12);
  return p.rating ** 2 * popularity * proximity;
}
