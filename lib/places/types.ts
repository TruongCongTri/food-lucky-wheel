export type Place = {
  id: string;
  name: string;
  address: string;
  rating: number;
  ratingCount: number;
  lat: number;
  lng: number;
  distanceKm: number | null;
  openNow: boolean | null;
  mapsUrl: string;
  photo: string | null;
  priceLevel: number | null;
};

export type PlacesResponse =
  | { status: "ok"; places: Place[] }
  | { status: "no_api_key" | "error"; places: [] };
