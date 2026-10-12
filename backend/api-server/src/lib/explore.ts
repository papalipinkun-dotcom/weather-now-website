import { heatMetrics } from "./weather-state";

// "Explore" lets a signed-in person look up real weather for any place and any
// date, using Open-Meteo (https://open-meteo.com). No API key is needed.
// Open-Meteo's free service is for non-commercial use.

export class ExploreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface PlaceResult {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface HourPoint {
  /** Local time at the place, e.g. "2026-10-07T13:00". */
  time: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPct: number;
  windSpeedMps: number;
  solarWm2: number;
  precipitationMm: number;
  condition: string;
  radiantTemperatureC: number;
  wbgtC: number;
  heatIndexC: number;
  riskLevel: string;
}

export interface ExploreResult {
  latitude: number;
  longitude: number;
  date: string;
  timezone: string;
  utcOffsetSeconds: number;
  /** "forecast" = live model data (recent past and next 15 days); "archive" = older reanalysis. */
  source: "forecast" | "archive";
  hours: HourPoint[];
  fetchedAt: string;
}

const HOURLY =
  "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,shortwave_radiation";
const DAY_MS = 86_400_000;
const MIN_DATE = "1940-01-01";
const FORECAST_DAYS_AHEAD = 15;
// Open-Meteo's forecast service keeps about 92 days of recent past; use the archive for older dates.
const FORECAST_DAYS_BACK = 80;

type Json = Record<string, unknown>;

const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const round1 = (value: number): number => Math.round(value * 10) / 10;

export async function getJson(url: URL): Promise<Json> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ExploreError("The weather service could not be reached. Please try again.", 502);
  }
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    const reason = typeof body["reason"] === "string" ? body["reason"] : "";
    if (res.status === 400 && reason) {
      throw new ExploreError(`No weather data for that request: ${reason}`, 400);
    }
    throw new ExploreError("The weather service returned an error. Please try again.", 502);
  }
  return body;
}

/** Valid real calendar date between 1940-01-01 and 15 days from today. */
export function validateDate(date: string, now = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const max = new Date(now + FORECAST_DAYS_AHEAD * DAY_MS).toISOString().slice(0, 10);
  return date >= MIN_DATE && date <= max;
}

export async function searchPlaces(query: string, indiaOnly = true): Promise<PlaceResult[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", indiaOnly ? "15" : "8");
  if (indiaOnly) url.searchParams.set("countryCode", "IN");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const body = await getJson(url);
  const results = Array.isArray(body["results"]) ? (body["results"] as Json[]) : [];
  const places: PlaceResult[] = [];
  for (const item of results) {
    const latitude = num(item["latitude"]);
    const longitude = num(item["longitude"]);
    if (latitude === undefined || longitude === undefined || typeof item["name"] !== "string") continue;
    places.push({
      id: String(item["id"] ?? `${latitude},${longitude}`),
      name: item["name"],
      region: typeof item["admin1"] === "string" ? item["admin1"] : "",
      country: typeof item["country"] === "string" ? item["country"] : "",
      latitude,
      longitude,
    });
  }
  return places;
}

const cache = new Map<string, { expires: number; value: ExploreResult }>();

export async function getDayWeather(
  latitude: number,
  longitude: number,
  date: string,
): Promise<ExploreResult> {
  const now = Date.now();
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)},${date}`;
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;

  const oldest = new Date(now - FORECAST_DAYS_BACK * DAY_MS).toISOString().slice(0, 10);
  const source = date < oldest ? "archive" : "forecast";
  const url = new URL(
    source === "archive"
      ? "https://archive-api.open-meteo.com/v1/archive"
      : "https://api.open-meteo.com/v1/forecast",
  );
  url.searchParams.set("latitude", latitude.toFixed(4));
  url.searchParams.set("longitude", longitude.toFixed(4));
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set("hourly", HOURLY);
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "auto");

  const body = await getJson(url);
  const hourly = (body["hourly"] ?? {}) as Json;
  const times = Array.isArray(hourly["time"]) ? (hourly["time"] as unknown[]) : [];
  const column = (name: string): unknown[] =>
    Array.isArray(hourly[name]) ? (hourly[name] as unknown[]) : [];
  const temp = column("temperature_2m");
  const humidity = column("relative_humidity_2m");
  const apparent = column("apparent_temperature");
  const rain = column("precipitation");
  const code = column("weather_code");
  const wind = column("wind_speed_10m");
  const sun = column("shortwave_radiation");

  const hours: HourPoint[] = [];
  times.forEach((time, i) => {
    const t = num(temp[i]);
    const rh = num(humidity[i]);
    const w = num(wind[i]);
    const sw = num(sun[i]);
    if (typeof time !== "string" || t === undefined || rh === undefined || w === undefined || sw === undefined) {
      return;
    }
    const metrics = heatMetrics({ temperatureC: t, humidityPct: rh, windSpeedMps: w, shortwaveWm2: sw });
    const weatherCode = num(code[i]);
    hours.push({
      time,
      temperatureC: round1(t),
      apparentTemperatureC: round1(num(apparent[i]) ?? t),
      humidityPct: Math.round(rh),
      windSpeedMps: round1(w),
      solarWm2: Math.round(sw),
      precipitationMm: round1(num(rain[i]) ?? 0),
      condition: weatherCode === undefined ? "—" : (WEATHER_CODES[weatherCode] ?? "—"),
      radiantTemperatureC: metrics.radiantTemperatureC,
      wbgtC: metrics.wbgtC,
      heatIndexC: metrics.heatIndexC,
      riskLevel: metrics.riskLevel,
    });
  });
  if (hours.length === 0) {
    throw new ExploreError("No weather data is available for that place and date.", 404);
  }

  const value: ExploreResult = {
    latitude: num(body["latitude"]) ?? latitude,
    longitude: num(body["longitude"]) ?? longitude,
    date,
    timezone: typeof body["timezone"] === "string" ? body["timezone"] : "UTC",
    utcOffsetSeconds: num(body["utc_offset_seconds"]) ?? 0,
    source,
    hours,
    fetchedAt: new Date(now).toISOString(),
  };
  const ttl = source === "archive" ? 6 * 3_600_000 : 10 * 60_000;
  cache.set(key, { expires: now + ttl, value });
  if (cache.size > 300) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  return value;
}
