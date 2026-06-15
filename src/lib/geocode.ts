/**
 * Best-effort geocoding of a vehicle's CURRENT location string (roadside, lot,
 * etc.) to map coordinates, via the Google Geocoding REST API.
 *
 * Returns null on any failure (no key, network error, no result, ambiguous
 * input like "location unclear"). A lead with no coords still saves and still
 * shows in the dashboard list — it just won't get a map pin.
 *
 * Uses GOOGLE_GEOCODING_KEY — a SERVER-side key, NOT the referrer-restricted
 * browser Maps key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). See .env.example.
 */
export type Coords = { lat: number; lng: number };

export async function geocode(location: string): Promise<Coords | null> {
  const key = process.env.GOOGLE_GEOCODING_KEY;
  if (!key || !location || !location.trim()) return null;

  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      encodeURIComponent(location) +
      "&key=" +
      key;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };
    if (data.status !== "OK") return null;

    const loc = data.results?.[0]?.geometry?.location;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      return null;
    }
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}
