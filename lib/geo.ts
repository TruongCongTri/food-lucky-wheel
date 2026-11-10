export type LatLng = { lat: number; lng: number };

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Google Maps directions deep link (opens the Maps app on mobile).
 * Origin = the user's current position, destination = the place.
 */
export function directionsUrl(
  dest: { id: string; name: string; address: string },
  origin: LatLng | null,
): string {
  const params = new URLSearchParams({ api: "1" });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  params.set("destination", `${dest.name}, ${dest.address}`);
  params.set("destination_place_id", dest.id);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Fallback when the Places API isn't available: a plain Maps search. */
export function mapsSearchUrl(query: string, origin: LatLng | null): string {
  if (origin) {
    return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${origin.lat},${origin.lng},15z`;
  }
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query })}`;
}

export function formatDistance(km: number, locale: string): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString(locale, { maximumFractionDigits: 1 })} km`;
}

export function getCurrentPosition(timeout = 12000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout, maximumAge: 5 * 60 * 1000 },
    );
  });
}
