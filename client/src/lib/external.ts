// Open-Meteo, Nominatim, OSRM clients (no API keys needed).

export interface WeatherDay {
  date: string;
  hi: number;
  lo: number;
  condition: "sunny" | "partly" | "cloudy" | "rain" | "showers";
  precipChance: number;
}

function codeToCondition(c: number): WeatherDay["condition"] {
  if (c === 0) return "sunny";
  if ([1, 2].includes(c)) return "partly";
  if (c === 3) return "cloudy";
  if ([51, 53, 55, 56, 57, 80, 81, 82].includes(c)) return "showers";
  if ([61, 63, 65, 66, 67, 71, 73, 75, 77, 85, 86, 95, 96, 99].includes(c)) return "rain";
  return "partly";
}

export async function fetchWeather(lat: number, lng: number, start: string, end: string): Promise<WeatherDay[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error("weather fetch failed");
  const j = await r.json();
  const days: WeatherDay[] = (j.daily?.time || []).map((d: string, i: number) => ({
    date: d,
    hi: Math.round(j.daily.temperature_2m_max[i]),
    lo: Math.round(j.daily.temperature_2m_min[i]),
    condition: codeToCondition(j.daily.weather_code[i]),
    precipChance: j.daily.precipitation_probability_max?.[i] ?? 0,
  }));
  return days;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

export async function geocode(query: string, limit = 5): Promise<GeocodeResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  const r = await fetch(url.toString(), {
    headers: { "Accept-Language": "en" },
  });
  if (!r.ok) throw new Error("geocode failed");
  const arr: any[] = await r.json();
  return arr.map((a) => ({
    lat: parseFloat(a.lat),
    lng: parseFloat(a.lon),
    display_name: a.display_name,
  }));
}

export async function osrmWalkRoute(coords: Array<[number, number]>): Promise<{
  geometry: Array<[number, number]>; // [lat,lng]
  durationSec: number;
  distanceMeters: number;
} | null> {
  if (coords.length < 2) return null;
  const path = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/walking/${path}?overview=full&geometries=geojson`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const route = j.routes?.[0];
    if (!route) return null;
    const geo: Array<[number, number]> = (route.geometry.coordinates as Array<[number, number]>).map(
      ([lng, lat]) => [lat, lng]
    );
    return {
      geometry: geo,
      durationSec: route.duration,
      distanceMeters: route.distance,
    };
  } catch {
    return null;
  }
}
