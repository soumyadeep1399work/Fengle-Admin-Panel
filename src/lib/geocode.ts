// Address search for the kitchen map. One small contract so the provider can be
// swapped for Google Maps later (decision 2026-10-28: OpenStreetMap for now) without
// touching the map component.
//
// OpenStreetMap's Nominatim is free but has a usage policy: at most ~1 request per
// second and no autocomplete-per-keystroke. So search runs only when the admin presses
// Enter / Search, results are cached, and calls are spaced at least 1.1 s apart.

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';
// Bias results toward Kolkata / Newtown (the launch area) without excluding the rest of India.
const VIEWBOX = '88.20,22.75,88.65,22.40';

let lastCall = 0;
const cache = new Map<string, Place[]>();

async function politeFetch(url: string): Promise<Response> {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'en' } });
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const params = new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'in', limit: '6', viewbox: VIEWBOX, bounded: '0' });
  const res = await politeFetch(`${NOMINATIM}/search?${params}`);
  if (!res.ok) throw new Error('Address search is unavailable right now. Drop the pin on the map instead.');
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  const places = rows.map((r) => ({ label: r.display_name, lat: Number(Number(r.lat).toFixed(7)), lng: Number(Number(r.lon).toFixed(7)) }));
  cache.set(key, places);
  return places;
}

export const SEARCH_ATTRIBUTION = 'Search by OpenStreetMap Nominatim';

/** Link an admin can open to double-check a pin against Google Maps' satellite view. */
export function googleMapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
