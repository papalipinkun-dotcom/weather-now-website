import { logger } from "./logger";
import { applyLiveData, getLiveTargets, type LiveObservation } from "./weather-state";

// Real weather for every monitored location, from Open-Meteo (https://open-meteo.com).
// No API key is needed. Open-Meteo's free service is for non-commercial use.
// Set LIVE_WEATHER=off to go back to generated demo values.
const REFRESH_MS = 15 * 60 * 1000; // about 70 places: keeps well inside Open-Meteo's free daily limit
const FIELDS = "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation";

type Json = Record<string, unknown>;

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

// Times are requested in GMT, e.g. "2026-10-07T01:15" (no "Z").
function toMs(time: unknown): number {
  if (typeof time !== "string") return Number.NaN;
  return Date.parse(time.endsWith("Z") ? time : `${time}Z`);
}

function observation(source: Json, timeMs: number): LiveObservation | undefined {
  const temperatureC = num(source["temperature_2m"]);
  const humidityPct = num(source["relative_humidity_2m"]);
  const windSpeedMps = num(source["wind_speed_10m"]);
  const shortwaveWm2 = num(source["shortwave_radiation"]);
  if (
    temperatureC === undefined ||
    humidityPct === undefined ||
    windSpeedMps === undefined ||
    shortwaveWm2 === undefined ||
    Number.isNaN(timeMs)
  ) {
    return undefined;
  }
  return {
    observedAt: new Date(timeMs).toISOString(),
    temperatureC,
    humidityPct,
    windSpeedMps,
    shortwaveWm2,
  };
}

function parseLocation(raw: unknown): {
  current: LiveObservation;
  past: LiveObservation[];
  future: LiveObservation[];
} | null {
  if (!raw || typeof raw !== "object") return null;
  const location = raw as Json;
  const currentBlock = location["current"] as Json | undefined;
  const hourly = location["hourly"] as Json | undefined;
  if (!currentBlock || !hourly) return null;

  const currentMs = toMs(currentBlock["time"]);
  const current = observation(currentBlock, currentMs);
  if (!current) return null;

  const times = Array.isArray(hourly["time"]) ? (hourly["time"] as unknown[]) : [];
  const column = (name: string): unknown[] =>
    Array.isArray(hourly[name]) ? (hourly[name] as unknown[]) : [];
  const temp = column("temperature_2m");
  const humidity = column("relative_humidity_2m");
  const wind = column("wind_speed_10m");
  const sun = column("shortwave_radiation");

  const past: LiveObservation[] = [];
  const future: LiveObservation[] = [];
  times.forEach((time, i) => {
    const timeMs = toMs(time);
    const obs = observation(
      {
        temperature_2m: temp[i],
        relative_humidity_2m: humidity[i],
        wind_speed_10m: wind[i],
        shortwave_radiation: sun[i],
      },
      timeMs,
    );
    if (!obs) return;
    if (timeMs < currentMs) past.push(obs);
    else if (timeMs > currentMs) future.push(obs);
  });
  return { current, past, future };
}

export async function refreshLiveWeather(): Promise<void> {
  const targets = getLiveTargets();
  if (targets.length === 0) return;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", targets.map((t) => t.latitude).join(","));
  url.searchParams.set("longitude", targets.map((t) => t.longitude).join(","));
  url.searchParams.set("current", FIELDS);
  url.searchParams.set("hourly", FIELDS);
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "GMT");
  url.searchParams.set("past_hours", "6");
  url.searchParams.set("forecast_hours", "4");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
    const body: unknown = await res.json();
    const locations = Array.isArray(body) ? body : [body];

    let applied = 0;
    targets.forEach((target, i) => {
      const parsed = parseLocation(locations[i]);
      if (!parsed) return;
      applyLiveData(target.id, parsed);
      applied += 1;
    });
    logger.info({ applied, total: targets.length }, "Live weather updated");
  } catch (err) {
    // Keep showing the last values; try again at the next refresh.
    logger.warn({ err }, "Could not update live weather");
  }
}

export function startLiveWeather(): void {
  if ((process.env["LIVE_WEATHER"] ?? "on").trim().toLowerCase() === "off") {
    logger.info("Live weather is switched off (LIVE_WEATHER=off). Showing demo values.");
    return;
  }
  void refreshLiveWeather();
  setInterval(() => void refreshLiveWeather(), REFRESH_MS).unref();
}
