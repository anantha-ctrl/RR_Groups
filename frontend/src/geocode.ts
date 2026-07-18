// Free address → coordinates lookup via OpenStreetMap Nominatim (no API key).
// Low-volume use only (form button clicks), per the Nominatim usage policy.

export interface GeoPoint {
  lat: number;
  lng: number;
  display?: string;
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const q = address.trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!rows.length) return null;
    const r = rows[0];
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng, display: r.display_name };
  } catch {
    return null;
  }
}
