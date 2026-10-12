import { ExploreError, getJson } from "./explore";
import { heatMetrics } from "./weather-state";

// Data behind the Map page. Everything comes from Open-Meteo (no API key):
//   - the forecast API for temperature, wind and pressure
//   - the air-quality API for pollutants and gases
// Radiant temperature, WBGT and the micro-weather signals are estimates made
// from those readings, not measurements from a sensor at that exact spot.

type Json = Record<string, unknown>;

export interface GridPoint {
  latitude: number;
  longitude: number;
  temperatureC: number;
  humidityPct: number;
  windSpeedMps: number;
  wbgtC: number;
  riskLevel: string;
}

export interface MicroSignal {
  id: "rapid-heating" | "cooling" | "radiant-heat" | "still-air" | "gusts" | "rain-soon" | "warm-pocket" | "uneven" | "calm";
  tone: "safe" | "caution" | "high" | "extreme";
  /** The number the message is about (degrees, m/s or mm). The page turns it into words. */
  value?: number;
}

export interface GasReading {
  key: string;
  label: string;
  value: number;
  unit: string;
}

export interface PointDetail {
  latitude: number;
  longitude: number;
  timezone: string;
  observedAt: string;
  condition: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPct: number;
  cloudCoverPct: number;
  precipitationMm: number;
  solarWm2: number;
  radiantTemperatureC: number;
  wbgtC: number;
  heatIndexC: number;
  riskLevel: string;
  wind: { speedMps: number; gustMps: number; directionDeg: number; from: string };
  pressure: { surfaceHpa: number; seaLevelHpa: number; trendHpa3h: number | null };
  air: { usAqi: number | null; gases: GasReading[] };
  micro: { signals: MicroSignal[]; localSpreadC: number | null; nearbyAverageC: number | null };
  nextHours: { time: string; temperatureC: number }[];
  fetchedAt: string;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const round1 = (v: number) => Math.round(v * 10) / 10;

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compassFor = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] ?? "N";

const CONDITIONS: Record<number, string> = {
  0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Light showers", 81: "Showers", 82: "Heavy showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
};

// ---------------------------------------------------------------- area grid

const gridCache = new Map<string, { expires: number; points: GridPoint[] }>();

/** A size x size block of live readings covering the visible map. */
export async function getAreaGrid(
  south: number, west: number, north: number, east: number, size: number,
): Promise<GridPoint[]> {
  const key = [south, west, north, east].map((v) => v.toFixed(1)).join(",") + `:${size}`;
  const hit = gridCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.points;

  const lats: number[] = [];
  const lons: number[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      lats.push(north - ((north - south) * row) / (size - 1));
      lons.push(west + ((east - west) * col) / (size - 1));
    }
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lats.map((v) => v.toFixed(3)).join(","));
  url.searchParams.set("longitude", lons.map((v) => v.toFixed(3)).join(","));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "auto");

  const body = (await getJson(url)) as unknown as Json | Json[];
  const list = Array.isArray(body) ? body : [body];
  const points: GridPoint[] = [];

  list.forEach((entry, i) => {
    const cur = (entry["current"] ?? {}) as Json;
    const t = num(cur["temperature_2m"]);
    const rh = num(cur["relative_humidity_2m"]);
    const wind = num(cur["wind_speed_10m"]) ?? 0;
    const sun = num(cur["shortwave_radiation"]) ?? 0;
    if (t === undefined || rh === undefined) return;
    const m = heatMetrics({ temperatureC: t, humidityPct: rh, windSpeedMps: wind, shortwaveWm2: sun });
    points.push({
      latitude: lats[i]!, longitude: lons[i]!,
      temperatureC: round1(t), humidityPct: Math.round(rh), windSpeedMps: round1(wind),
      wbgtC: m.wbgtC, riskLevel: m.riskLevel,
    });
  });

  if (points.length < size * size) throw new ExploreError("The weather service sent an incomplete map. Please try again.", 502);
  gridCache.set(key, { expires: Date.now() + 10 * 60_000, points });
  if (gridCache.size > 60) gridCache.delete(gridCache.keys().next().value as string);
  return points;
}

// ------------------------------------------------------------- point detail

async function getAir(lat: number, lon: number): Promise<{ usAqi: number | null; gases: GasReading[] }> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("current", "us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone");
  const cur = (((await getJson(url))["current"] ?? {}) as Json);
  const defs: [string, string, string][] = [
    ["ozone", "Ozone (O₃)", "µg/m³"],
    ["nitrogen_dioxide", "Nitrogen dioxide (NO₂)", "µg/m³"],
    ["sulphur_dioxide", "Sulphur dioxide (SO₂)", "µg/m³"],
    ["carbon_monoxide", "Carbon monoxide (CO)", "µg/m³"],
    ["pm2_5", "Fine dust (PM2.5)", "µg/m³"],
    ["pm10", "Dust (PM10)", "µg/m³"],
  ];
  const gases: GasReading[] = [];
  for (const [key, label, unit] of defs) {
    const value = num(cur[key]);
    if (value !== undefined) gases.push({ key, label, value: round1(value), unit });
  }
  return { usAqi: num(cur["us_aqi"]) ?? null, gases };
}

// Carbon dioxide and methane come from the global model only, so they are
// requested on their own and simply left out if the service does not return them.
async function getGreenhouse(lat: number, lon: number): Promise<GasReading[]> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("current", "carbon_dioxide,methane");
  const cur = (((await getJson(url))["current"] ?? {}) as Json);
  const out: GasReading[] = [];
  const co2 = num(cur["carbon_dioxide"]);
  const ch4 = num(cur["methane"]);
  if (co2 !== undefined) out.push({ key: "carbon_dioxide", label: "Carbon dioxide (CO₂)", value: Math.round(co2), unit: "ppm" });
  if (ch4 !== undefined) out.push({ key: "methane", label: "Methane (CH₄)", value: Math.round(ch4), unit: "ppb" });
  return out;
}

/** Temperatures ~3 km around the point, used to see how much the spot differs from its surroundings. */
async function getRing(lat: number, lon: number): Promise<number[]> {
  const step = 0.027;
  const dLon = step / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const offsets: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", offsets.map(([a]) => (lat + a * step).toFixed(4)).join(","));
  url.searchParams.set("longitude", offsets.map(([, b]) => (lon + b * dLon).toFixed(4)).join(","));
  url.searchParams.set("current", "temperature_2m");
  const body = (await getJson(url)) as unknown as Json | Json[];
  return (Array.isArray(body) ? body : [body])
    .map((e) => num(((e["current"] ?? {}) as Json)["temperature_2m"]))
    .filter((v): v is number => v !== undefined);
}

export async function getPointDetail(lat: number, lon: number): Promise<PointDetail> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,shortwave_radiation",
  );
  url.searchParams.set("hourly", "temperature_2m,pressure_msl,precipitation");
  url.searchParams.set("past_hours", "3");
  url.searchParams.set("forecast_hours", "12");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "auto");

  // The extras are optional: if one fails, the panel still shows everything else.
  const [body, air, greenhouse, ring] = await Promise.all([
    getJson(url),
    getAir(lat, lon).catch(() => null),
    getGreenhouse(lat, lon).catch(() => [] as GasReading[]),
    getRing(lat, lon).catch(() => [] as number[]),
  ]);

  const cur = (body["current"] ?? {}) as Json;
  const t = num(cur["temperature_2m"]);
  const rh = num(cur["relative_humidity_2m"]);
  if (t === undefined || rh === undefined) throw new ExploreError("No weather is available for that spot.", 404);

  const wind = num(cur["wind_speed_10m"]) ?? 0;
  const gust = num(cur["wind_gusts_10m"]) ?? wind;
  const dir = num(cur["wind_direction_10m"]) ?? 0;
  const sun = num(cur["shortwave_radiation"]) ?? 0;
  const metrics = heatMetrics({ temperatureC: t, humidityPct: rh, windSpeedMps: wind, shortwaveWm2: sun });

  // Hourly arrays begin 3 hours in the past, so index 3 is "now".
  const hourly = (body["hourly"] ?? {}) as Json;
  const hTime = (hourly["time"] as string[] | undefined) ?? [];
  const hTemp = (hourly["temperature_2m"] as (number | null)[] | undefined) ?? [];
  const hPres = (hourly["pressure_msl"] as (number | null)[] | undefined) ?? [];
  const hRain = (hourly["precipitation"] as (number | null)[] | undefined) ?? [];
  const nowIdx = Math.min(3, Math.max(0, hTime.length - 1));

  const seaLevel = num(cur["pressure_msl"]) ?? 0;
  const before = num(hPres[0] ?? undefined);
  const trend3h = before !== undefined && seaLevel ? round1(seaLevel - before) : null;

  const tempAgo = num(hTemp[Math.max(0, nowIdx - 1)] ?? undefined);
  const heatingRate = tempAgo !== undefined ? round1(t - tempAgo) : null;
  const rainSoon = hRain.slice(nowIdx + 1, nowIdx + 3).reduce<number>((sum, v) => sum + (v ?? 0), 0);

  const around = ring.length ? ring : null;
  const nearbyAverage = around ? round1(around.reduce((a, b) => a + b, 0) / around.length) : null;
  const spread = around ? round1(Math.max(t, ...around) - Math.min(t, ...around)) : null;

  const signals: MicroSignal[] = [];
  if (heatingRate !== null && heatingRate >= 1.5) {
    signals.push({ id: "rapid-heating", tone: heatingRate >= 2.5 ? "high" : "caution", value: heatingRate });
  } else if (heatingRate !== null && heatingRate <= -1.5) {
    signals.push({ id: "cooling", tone: "safe", value: Math.abs(heatingRate) });
  }
  const boost = round1(metrics.radiantTemperatureC - t);
  if (boost >= 5) {
    signals.push({ id: "radiant-heat", tone: boost >= 9 ? "extreme" : "high", value: boost });
  }
  if (wind < 1 && t >= 32) {
    signals.push({ id: "still-air", tone: "high", value: round1(wind) });
  }
  if (gust >= 12) {
    signals.push({ id: "gusts", tone: gust >= 17 ? "high" : "caution", value: round1(gust) });
  }
  if (rainSoon >= 0.3) {
    signals.push({ id: "rain-soon", tone: "caution", value: round1(rainSoon) });
  }
  if (nearbyAverage !== null && t - nearbyAverage >= 0.8) {
    signals.push({ id: "warm-pocket", tone: "caution", value: round1(t - nearbyAverage) });
  }
  if (spread !== null && spread >= 2) {
    signals.push({ id: "uneven", tone: "caution", value: spread });
  }
  if (signals.length === 0) {
    signals.push({ id: "calm", tone: "safe" });
  }

  const weatherCode = num(cur["weather_code"]);
  const nextHours = hTime
    .map((time, i) => ({ time, temperatureC: num(hTemp[i] ?? undefined) }))
    .filter((h, i): h is { time: string; temperatureC: number } => i >= nowIdx && h.temperatureC !== undefined)
    .map((h) => ({ time: h.time, temperatureC: round1(h.temperatureC) }));

  return {
    latitude: num(body["latitude"]) ?? lat,
    longitude: num(body["longitude"]) ?? lon,
    timezone: typeof body["timezone"] === "string" ? body["timezone"] : "UTC",
    observedAt: typeof cur["time"] === "string" ? cur["time"] : new Date().toISOString(),
    condition: weatherCode === undefined ? "—" : (CONDITIONS[weatherCode] ?? "—"),
    temperatureC: round1(t),
    apparentTemperatureC: round1(num(cur["apparent_temperature"]) ?? t),
    humidityPct: Math.round(rh),
    cloudCoverPct: Math.round(num(cur["cloud_cover"]) ?? 0),
    precipitationMm: round1(num(cur["precipitation"]) ?? 0),
    solarWm2: Math.round(sun),
    radiantTemperatureC: metrics.radiantTemperatureC,
    wbgtC: metrics.wbgtC,
    heatIndexC: metrics.heatIndexC,
    riskLevel: metrics.riskLevel,
    wind: { speedMps: round1(wind), gustMps: round1(gust), directionDeg: Math.round(dir), from: compassFor(dir) },
    pressure: { surfaceHpa: Math.round(num(cur["surface_pressure"]) ?? 0), seaLevelHpa: Math.round(seaLevel), trendHpa3h: trend3h },
    air: { usAqi: air?.usAqi ?? null, gases: [...(air?.gases ?? []), ...greenhouse] },
    micro: { signals, localSpreadC: spread, nearbyAverageC: nearbyAverage },
    nextHours,
    fetchedAt: new Date().toISOString(),
  };
}
