import type {
  DashboardSnapshot,
  ForecastPoint,
  ForecastSnapshot,
  HeatAlert,
  HeatmapSnapshot,
  NodeSummary,
  RiskLevel,
  SensorReading,
  SimulationState,
  WorkerAction,
} from "@workspace/api-zod";
import { INDIA_PLACES, indiaPlaceId } from "./india-places";

const SAMPLE_INTERVAL_MS = 3_000;
const MAX_HISTORY = 120;
const PRIMARY_NODE_ID = "ahd-science-rooftop";

type SimulationScenario = "NORMAL" | "HEATWAVE";
type WorkerActionType = "FAN_ON" | "REST_BREAK";

const featuredNodes: NodeSummary[] = [
  {
    id: PRIMARY_NODE_ID,
    name: "Science City Rooftop",
    siteType: "Rooftop",
    city: "Ahmedabad",
    location: "Science City",
    latitude: 23.0712,
    longitude: 72.5164,
    riskLevel: "MODERATE",
    temperatureC: 36.2,
    humidityPct: 38,
    wbgtC: 27.2,
    heatIndexC: 40.1,
    radiantTemperatureC: 41.8,
    windSpeedMps: 0.8,
    solarExposureLux: 89_000,
    updatedAt: new Date().toISOString(),
    source: "DEMO",
  },
  {
    id: "ahd-amts-bus-stop",
    name: "AMTS Bus Stop",
    siteType: "Transit stop",
    city: "Ahmedabad",
    location: "Paldi",
    latitude: 23.0121,
    longitude: 72.5597,
    riskLevel: "HIGH",
    temperatureC: 37.4,
    humidityPct: 34,
    wbgtC: 29.1,
    heatIndexC: 41.6,
    radiantTemperatureC: 45.2,
    windSpeedMps: 0.5,
    solarExposureLux: 96_000,
    updatedAt: new Date().toISOString(),
    source: "DEMO",
  },
  {
    id: "del-south-campus",
    name: "South Campus Yard",
    siteType: "Schoolyard",
    city: "Delhi",
    location: "South Campus",
    latitude: 28.5889,
    longitude: 77.1636,
    riskLevel: "HIGH",
    temperatureC: 38.2,
    humidityPct: 31,
    wbgtC: 30.2,
    heatIndexC: 42.7,
    radiantTemperatureC: 46.1,
    windSpeedMps: 0.7,
    solarExposureLux: 102_000,
    updatedAt: new Date().toISOString(),
    source: "DEMO",
  },
  {
    id: "jai-construction",
    name: "Mansarovar Worksite",
    siteType: "Construction site",
    city: "Jaipur",
    location: "Mansarovar",
    latitude: 26.8505,
    longitude: 75.7627,
    riskLevel: "EXTREME",
    temperatureC: 40.1,
    humidityPct: 26,
    wbgtC: 32.4,
    heatIndexC: 43.2,
    radiantTemperatureC: 49.4,
    windSpeedMps: 0.4,
    solarExposureLux: 110_000,
    updatedAt: new Date().toISOString(),
    source: "DEMO",
  },
  {
    id: "pun-school-courtyard",
    name: "Aundh School Courtyard",
    siteType: "Schoolyard",
    city: "Pune",
    location: "Aundh",
    latitude: 18.559,
    longitude: 73.8077,
    riskLevel: "MODERATE",
    temperatureC: 33.4,
    humidityPct: 43,
    wbgtC: 26.3,
    heatIndexC: 36.3,
    radiantTemperatureC: 37.4,
    windSpeedMps: 1.7,
    solarExposureLux: 74_000,
    updatedAt: new Date().toISOString(),
    source: "DEMO",
  },
  {
    id: "hyd-transit-hub",
    name: "Miyapur Transit Hub",
    siteType: "Transit hub",
    city: "Hyderabad",
    location: "Miyapur",
    latitude: 17.4968,
    longitude: 78.3594,
    riskLevel: "EXTREME",
    temperatureC: 38.9,
    humidityPct: 39,
    wbgtC: 31.6,
    heatIndexC: 44.8,
    radiantTemperatureC: 47.5,
    windSpeedMps: 0.6,
    solarExposureLux: 98_000,
    updatedAt: new Date().toISOString(),
    source: "DEMO",
  },
  {
    id: "che-community-clinic",
    name: "Adyar Community Clinic",
    siteType: "Community clinic",
    city: "Chennai",
    location: "Adyar",
    latitude: 13.0067,
    longitude: 80.2572,
    riskLevel: "HIGH",
    temperatureC: 34.8,
    humidityPct: 67,
    wbgtC: 29.2,
    heatIndexC: 43.7,
    radiantTemperatureC: 38.7,
    windSpeedMps: 1.2,
    solarExposureLux: 68_000,
    updatedAt: new Date().toISOString(),
    source: "DEMO",
  },
  {
    id: "kol-station-approach",
    name: "Howrah Station Approach",
    siteType: "Transit area",
    city: "Kolkata",
    location: "Howrah",
    latitude: 22.5851,
    longitude: 88.3426,
    riskLevel: "HIGH",
    temperatureC: 35.6,
    humidityPct: 62,
    wbgtC: 30,
    heatIndexC: 45.1,
    radiantTemperatureC: 40.8,
    windSpeedMps: 0.7,
    solarExposureLux: 72_000,
    updatedAt: new Date().toISOString(),
    source: "DEMO",
  },
];

/**
 * Starting values for the India-wide places. They are only placeholders for the
 * first seconds: live weather replaces them as soon as Open-Meteo answers.
 */
function indiaNodes(): NodeSummary[] {
  const taken = new Set(featuredNodes.map((node) => node.city.toLowerCase()));
  return INDIA_PLACES.filter(([city]) => !taken.has(city.toLowerCase())).map(([city, state, latitude, longitude, kind]) => {
    const temperatureC = round(31 + ((latitude * 7 + longitude * 3) % 6));
    const humidityPct = Math.round(40 + ((longitude * 5) % 35));
    const windSpeedMps = round(0.5 + (latitude % 1.5), 1);
    const radiantTemperatureC = round(temperatureC + 5);
    const wbgtC = estimateWbgtC(temperatureC, humidityPct, radiantTemperatureC);
    return {
      id: indiaPlaceId(city),
      name: `${city} City Monitor`,
      siteType: kind === "capital" ? "Capital city" : "City centre",
      city,
      location: state,
      latitude,
      longitude,
      riskLevel: riskForWbgt(wbgtC),
      temperatureC,
      humidityPct,
      wbgtC,
      heatIndexC: estimateHeatIndexC(temperatureC, humidityPct),
      radiantTemperatureC,
      windSpeedMps,
      solarExposureLux: Math.round(70_000 + ((latitude * 1000) % 40_000)),
      updatedAt: new Date().toISOString(),
      source: "DEMO" as const,
    };
  });
}

const initialNodes: NodeSummary[] = [...featuredNodes, ...indiaNodes()];

let nodes = initialNodes;
let scenario: SimulationScenario = "NORMAL";
let networkOnline = true;
let heatwaveStep = 0;
let bufferedReadings = 0;
let lastSampleAt = Date.now();
let idCounter = 10_000;
let lastTemperatureC = initialNodes[0].temperatureC;
const officialStationTemperatureC = 36.2;
const readingsByNode: Record<string, SensorReading[]> = {};
const previousHourByNode: Record<string, SensorReading> = {};
const workerActions: WorkerAction[] = [];
const liveSeriesByNode: Record<string, LiveObservation[]> = {};
let demoAlertsRetired = false;

/** One real weather observation for a node (from the live weather feed). */
export interface LiveObservation {
  observedAt: string;
  temperatureC: number;
  humidityPct: number;
  windSpeedMps: number;
  /** Shortwave (sunlight) radiation in W/m2. */
  shortwaveWm2: number;
}

const alerts: HeatAlert[] = [
  createAlert({
    type: "RADIANT_HEAT_ALERT",
    title: "Radiant heat above air temperature",
    description:
      "Surface and radiant exposure at Science City Rooftop is more than 5°C above the air reading.",
    severity: "MODERATE",
    nodeId: PRIMARY_NODE_ID,
    location: "Science City Rooftop, Ahmedabad",
    recommendation: "Move exposed work to shade and check surface temperature again.",
  }),
  createAlert({
    type: "WBGT_HIGH",
    title: "High WBGT at an outdoor worksite",
    description:
      "Mansarovar Worksite is above the high-risk WBGT threshold in this demo snapshot.",
    severity: "EXTREME",
    nodeId: "jai-construction",
    location: "Mansarovar, Jaipur",
    recommendation: "Pause strenuous outdoor work and move the crew to a cooled rest area.",
  }),
  createAlert({
    type: "LOCAL_HEAT_GAP",
    title: "Street-level heat exceeds the station reading",
    description:
      "The local node is tracking a hotter exposure profile than the official station can represent.",
    severity: "HIGH",
    nodeId: "ahd-amts-bus-stop",
    location: "Paldi, Ahmedabad",
    recommendation: "Use the local node reading for site-level work planning.",
  }),
];

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function round(value: number, places = 1): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function riskForWbgt(wbgtC: number): RiskLevel {
  if (wbgtC >= 32) return "EXTREME";
  if (wbgtC >= 28) return "HIGH";
  return "MODERATE";
}

function createAlert(input: Omit<HeatAlert, "id" | "createdAt" | "status">): HeatAlert {
  return {
    ...input,
    id: nextId("alert"),
    createdAt: new Date().toISOString(),
    status: "ACTIVE",
  };
}

function createReading(node: NodeSummary, observedAt = new Date().toISOString()): SensorReading {
  return {
    id: nextId("reading"),
    nodeId: node.id,
    observedAt,
    temperatureC: node.temperatureC,
    humidityPct: node.humidityPct,
    radiantTemperatureC: node.radiantTemperatureC,
    windSpeedMps: node.windSpeedMps,
    solarExposureLux: node.solarExposureLux,
    wbgtC: node.wbgtC,
    heatIndexC: node.heatIndexC,
    riskLevel: node.riskLevel,
    source: node.source,
  };
}

function initializeHistory(node: NodeSummary): SensorReading[] {
  return Array.from({ length: 24 }, (_, index) => {
    const minutesAgo = (23 - index) * 2.5;
    const wave = Math.sin(index / 3.2 - 0.65);
    return {
      ...createReading(node, new Date(Date.now() - minutesAgo * 60_000).toISOString()),
      temperatureC: round(node.temperatureC + wave * 0.7),
      wbgtC: round(node.wbgtC + wave * 0.45),
      heatIndexC: round(node.heatIndexC + wave * 0.8),
      humidityPct: round(node.humidityPct - wave * 2, 0),
      radiantTemperatureC: round(node.radiantTemperatureC + wave * 0.9),
      windSpeedMps: round(Math.max(0, node.windSpeedMps - wave * 0.2), 1),
      solarExposureLux: Math.round(node.solarExposureLux * (1 - wave * 0.04)),
    };
  });
}

for (const baseNode of nodes) {
  const history = initializeHistory(baseNode);
  readingsByNode[baseNode.id] = history;
  previousHourByNode[baseNode.id] = history[0];
}

function getCurrentNode(nodeId: string): NodeSummary {
  const base = nodes.find((candidate) => candidate.id === nodeId);
  if (!base) {
    throw new Error(`Unknown node: ${nodeId}`);
  }

  const appliesHeatwave = scenario === "HEATWAVE" && base.source === "DEMO";
  const intensity = appliesHeatwave ? heatwaveStep : 0;
  const multiplier = base.id === PRIMARY_NODE_ID ? 1 : 0.42;
  const temperatureC = round(base.temperatureC + intensity * multiplier * 0.625);
  const wbgtC = round(base.wbgtC + intensity * multiplier * 0.85);
  const heatIndexC = round(base.heatIndexC + intensity * multiplier * 1.05);
  const radiantTemperatureC = round(base.radiantTemperatureC + intensity * multiplier * 0.9);
  const humidityPct = Math.min(100, Math.max(0, round(base.humidityPct + intensity * 0.18, 0)));

  return {
    ...base,
    previousHour: previousHourByNode[base.id],
    riskLevel: riskForWbgt(wbgtC),
    temperatureC,
    humidityPct,
    wbgtC,
    heatIndexC,
    radiantTemperatureC,
    solarExposureLux: Math.min(200_000, base.solarExposureLux + intensity * 1_450),
    updatedAt: base.source === "LIVE_WEATHER" ? base.updatedAt : new Date().toISOString(),
  };
}

function currentNodes(): NodeSummary[] {
  return nodes.map((node) => getCurrentNode(node.id));
}

function appendCurrentSamples(observedAt: string): void {
  for (const node of currentNodes()) {
    if (node.source === "LIVE_WEATHER") continue; // live nodes only get real observations
    const history = readingsByNode[node.id] ?? [];
    history.push(createReading(node, observedAt));
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    readingsByNode[node.id] = history;
  }
}

function updateDynamicAlerts(): void {
  const primary = getCurrentNode(PRIMARY_NODE_ID);
  const primaryNodeLabel = `${primary.location}, ${primary.city}`;

  if (primary.radiantTemperatureC - primary.temperatureC >= 5) {
    ensureAlert(
      "RADIANT_HEAT_ALERT",
      "Radiant heat above air temperature",
      `Radiant exposure at ${primary.name} is ${round(primary.radiantTemperatureC - primary.temperatureC)}°C above air temperature.`,
      primary.riskLevel,
      primary.id,
      primaryNodeLabel,
      "Move exposed work to shade and check surface temperature again.",
    );
  }

  if (scenario === "HEATWAVE" && heatwaveStep >= 1) {
    ensureAlert(
      "RAPID_HEATING_ALERT",
      "Rapid heating detected",
      `Local temperature at ${primary.name} has risen ${round(primary.temperatureC - lastTemperatureC)}°C since the last sample.`,
      primary.riskLevel,
      primary.id,
      primaryNodeLabel,
      "Start cooling actions early and shorten outdoor work intervals.",
    );
  }

  if (scenario === "HEATWAVE" && primary.riskLevel !== "MODERATE") {
    ensureAlert(
      "HEATWAVE_EARLY_WARNING",
      "Heatwave early warning",
      `The edge trend model predicts continued heating at ${primary.name}. Personalized notice prepared for Ravi, an outdoor worker.`,
      primary.riskLevel,
      primary.id,
      primaryNodeLabel,
      "Notify the outdoor crew, schedule a shaded rest break, and keep water accessible.",
    );
  }

  if (scenario === "HEATWAVE" && primary.riskLevel === "EXTREME") {
    ensureAlert(
      "PERSONALIZED_WORKER_ALERT",
      "Worker exposure alert",
      "Personalized demo alert for Ravi: current heat exposure is extreme at the active worksite.",
      "EXTREME",
      primary.id,
      primaryNodeLabel,
      "Stop strenuous work, move to cooling, and confirm the worker is safe.",
    );
  }

  for (const node of currentNodes()) {
    if (node.source !== "LIVE_WEATHER") continue;
    const type = `LIVE_HEAT_${node.id}`;
    const active = alerts.find((alert) => alert.type === type && alert.status === "ACTIVE");
    if (node.riskLevel !== "MODERATE") {
      if (!active) {
        alerts.unshift(
          createAlert({
            type,
            title: node.riskLevel === "EXTREME" ? "Extreme heat stress (WBGT)" : "High heat stress (WBGT)",
            description: `${node.name}, ${node.city}: air ${node.temperatureC}°C, humidity ${node.humidityPct}%, estimated WBGT ${node.wbgtC}°C (from live weather).`,
            severity: node.riskLevel,
            nodeId: node.id,
            location: `${node.location}, ${node.city}`,
            recommendation:
              node.riskLevel === "EXTREME"
                ? "Pause strenuous outdoor work; use shade, water and a cooled rest area."
                : "Schedule frequent shaded rest breaks and keep drinking water available.",
          }),
        );
      }
    } else if (active) {
      active.status = "ACKNOWLEDGED";
    }
  }

  if (!networkOnline) {
    ensureAlert(
      "EDGE_OFFLINE_CLOUD_ALERT",
      "Cloud offline — Edge AI running",
      "The cloud connection is unavailable. The edge node continues risk evaluation and buffers readings locally.",
      "HIGH",
      primary.id,
      primaryNodeLabel,
      "Keep the edge node powered; buffered readings will sync when the connection returns.",
    );
  }
}

function ensureAlert(
  type: string,
  title: string,
  description: string,
  severity: RiskLevel,
  nodeId: string,
  location: string,
  recommendation: string,
): void {
  const existing = alerts.find((alert) => alert.type === type && alert.status === "ACTIVE");
  if (!existing) {
    alerts.unshift(createAlert({ type, title, description, severity, nodeId, location, recommendation }));
  }
}

function advanceSimulation(): void {
  const now = Date.now();
  const elapsedIntervals = Math.floor((now - lastSampleAt) / SAMPLE_INTERVAL_MS);
  if (elapsedIntervals < 1) return;

  const intervals = Math.min(elapsedIntervals, 20);
  lastSampleAt += intervals * SAMPLE_INTERVAL_MS;
  const previousTemperature = getCurrentNode(PRIMARY_NODE_ID).temperatureC;

  if (scenario === "HEATWAVE") {
    heatwaveStep = Math.min(12, heatwaveStep + intervals);
  }
  if (!networkOnline) {
    bufferedReadings += intervals;
  }

  appendCurrentSamples(new Date(now).toISOString());
  lastTemperatureC = previousTemperature;
  updateDynamicAlerts();
}

function liveForecastForNode(nodeId: string): ForecastPoint[] | undefined {
  const series = liveSeriesByNode[nodeId];
  const base = nodes.find((candidate) => candidate.id === nodeId);
  if (!series || series.length < 2 || !base || base.source !== "LIVE_WEATHER") return undefined;
  const startMs = Date.parse(series[0].observedAt);
  const times = series.map((point) => Date.parse(point.observedAt));
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
  return [0, 15, 30, 45, 60].map((minutes, index) => {
    const t = startMs + minutes * 60_000;
    let i = times.findIndex((value) => value >= t);
    if (i < 0) i = times.length - 1;
    const lo = Math.max(0, i - 1);
    const span = times[i] - times[lo];
    const f = span > 0 ? Math.min(1, Math.max(0, (t - times[lo]) / span)) : 0;
    const a = series[lo];
    const b = series[i];
    const point = nodeFromObservation(base, {
      observedAt: new Date(t).toISOString(),
      temperatureC: lerp(a.temperatureC, b.temperatureC, f),
      humidityPct: lerp(a.humidityPct, b.humidityPct, f),
      windSpeedMps: lerp(a.windSpeedMps, b.windSpeedMps, f),
      shortwaveWm2: lerp(a.shortwaveWm2, b.shortwaveWm2, f),
    });
    return {
      time: minutes === 0 ? "Now" : `+${minutes}m`,
      temperatureC: point.temperatureC,
      wbgtC: point.wbgtC,
      heatIndexC: point.heatIndexC,
      confidencePct: 92 - index * 3,
      riskLevel: point.riskLevel,
    };
  });
}

function forecastForNode(nodeId: string): ForecastPoint[] {
  const liveForecast = liveForecastForNode(nodeId);
  if (liveForecast) return liveForecast;
  const node = getCurrentNode(nodeId);
  const heatwave = scenario === "HEATWAVE";
  return [0, 15, 30, 45, 60].map((minutes, index) => {
    const warming = heatwave ? index * (0.5 + Math.min(heatwaveStep * 0.035, 0.45)) : index * 0.18;
    const wbgtC = round(node.wbgtC + warming * 0.86);
    return {
      time: minutes === 0 ? "Now" : `+${minutes}m`,
      temperatureC: round(node.temperatureC + warming),
      wbgtC,
      heatIndexC: round(node.heatIndexC + warming * 1.15),
      confidencePct: Math.max(64, 94 - index * (heatwave ? 5 : 4)),
      riskLevel: riskForWbgt(wbgtC),
    };
  });
}

export function getDashboardSnapshot(): DashboardSnapshot {
  advanceSimulation();
  updateDynamicAlerts();
  const primaryNode = getCurrentNode(PRIMARY_NODE_ID);
  return {
    primaryNode,
    officialStationTemperatureC: primaryNode.source === "LIVE_WEATHER" ? primaryNode.temperatureC : officialStationTemperatureC,
    temperatureDifferenceC:
      primaryNode.source === "LIVE_WEATHER" ? 0 : round(primaryNode.temperatureC - officialStationTemperatureC),
    forecast: forecastForNode(PRIMARY_NODE_ID),
    history: (readingsByNode[PRIMARY_NODE_ID] ?? []).slice(-24),
    activeAlertCount: alerts.filter((alert) => alert.status === "ACTIVE").length,
    monitoredNodeCount: nodes.length,
    systemStatus: networkOnline ? "CONNECTED" : "EDGE_OFFLINE",
  };
}

export function getNodeSummaries(): NodeSummary[] {
  advanceSimulation();
  updateDynamicAlerts();
  return currentNodes();
}

export function getNodeSummary(nodeId: string): NodeSummary | undefined {
  advanceSimulation();
  updateDynamicAlerts();
  return nodes.some((node) => node.id === nodeId) ? getCurrentNode(nodeId) : undefined;
}

export function getReadings(nodeId: string): SensorReading[] | undefined {
  advanceSimulation();
  if (!readingsByNode[nodeId]) return undefined;
  return readingsByNode[nodeId].slice(-60);
}

export function getHeatmapSnapshot(): HeatmapSnapshot {
  const current = getNodeSummaries();
  const counts = { moderate: 0, high: 0, extreme: 0 };
  for (const node of current) {
    counts[node.riskLevel.toLowerCase() as keyof typeof counts] += 1;
  }
  return {
    updatedAt: new Date().toISOString(),
    cities: new Set(current.map((node) => node.city)).size,
    counts,
    nodes: current,
  };
}

export function getForecastSnapshot(nodeId: string): ForecastSnapshot | undefined {
  advanceSimulation();
  const target = nodes.find((node) => node.id === nodeId);
  if (!target) return undefined;
  const isLive = target.source === "LIVE_WEATHER" && Boolean(liveForecastForNode(nodeId));
  return {
    nodeId,
    generatedAt: new Date().toISOString(),
    horizonMinutes: 60,
    model: isLive
      ? "Open-Meteo hourly forecast, interpolated to 15 minutes"
      : "Weather Now edge trend model • prototype",
    simulated: !isLive,
    points: forecastForNode(nodeId),
  };
}

export function getHeatAlerts(): HeatAlert[] {
  advanceSimulation();
  updateDynamicAlerts();
  return [...alerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function acknowledgeAlert(alertId: string): HeatAlert | undefined {
  const alert = alerts.find((candidate) => candidate.id === alertId);
  if (!alert) return undefined;
  alert.status = "ACKNOWLEDGED";
  return alert;
}

export function getSimulationState(): SimulationState {
  advanceSimulation();
  return {
    scenario,
    networkOnline,
    step: heatwaveStep,
    edgeAiRunning: true,
    bufferedReadings,
    updatedAt: new Date().toISOString(),
  };
}

export function updateSimulationState(update: {
  scenario?: SimulationScenario;
  networkOnline?: boolean;
}): SimulationState {
  advanceSimulation();
  if (update.scenario !== undefined && update.scenario !== scenario) {
    scenario = update.scenario;
    heatwaveStep = 0;
    lastTemperatureC = getCurrentNode(PRIMARY_NODE_ID).temperatureC;
    if (scenario === "NORMAL") {
      for (const alert of alerts) {
        if (
          ["RAPID_HEATING_ALERT", "HEATWAVE_EARLY_WARNING", "PERSONALIZED_WORKER_ALERT"].includes(
            alert.type,
          ) &&
          alert.status === "ACTIVE"
        ) {
          alert.status = "ACKNOWLEDGED";
        }
      }
    }
  }

  if (update.networkOnline !== undefined && update.networkOnline !== networkOnline) {
    networkOnline = update.networkOnline;
    if (networkOnline) {
      bufferedReadings = 0;
      for (const alert of alerts) {
        if (alert.type === "EDGE_OFFLINE_CLOUD_ALERT" && alert.status === "ACTIVE") {
          alert.status = "ACKNOWLEDGED";
        }
      }
    }
  }
  lastSampleAt = Date.now();
  updateDynamicAlerts();
  return getSimulationState();
}

export function ingestSensorReading(input: {
  nodeId: string;
  observedAt?: Date | string;
  temperatureC: number;
  humidityPct: number;
  radiantTemperatureC: number;
  windSpeedMps: number;
  solarExposureLux: number;
  wbgtC?: number;
  heatIndexC?: number;
}): SensorReading | undefined {
  const nodeIndex = nodes.findIndex((node) => node.id === input.nodeId);
  if (nodeIndex < 0) return undefined;

  const heatIndexC = input.heatIndexC ?? estimateHeatIndexC(input.temperatureC, input.humidityPct);
  const wbgtC =
    input.wbgtC ??
    estimateWbgtC(input.temperatureC, input.humidityPct, input.radiantTemperatureC);
  const observedAt =
    input.observedAt instanceof Date
      ? input.observedAt.toISOString()
      : input.observedAt ?? new Date().toISOString();
  const updatedNode: NodeSummary = {
    ...nodes[nodeIndex],
    temperatureC: round(input.temperatureC),
    humidityPct: round(input.humidityPct, 0),
    radiantTemperatureC: round(input.radiantTemperatureC),
    windSpeedMps: round(input.windSpeedMps, 1),
    solarExposureLux: Math.round(input.solarExposureLux),
    wbgtC: round(wbgtC),
    heatIndexC: round(heatIndexC),
    riskLevel: riskForWbgt(wbgtC),
    updatedAt: observedAt,
    source: "EDGE_DEVICE",
  };
  nodes[nodeIndex] = updatedNode;

  const reading = createReading(updatedNode, observedAt);
  const history = readingsByNode[input.nodeId] ?? [];
  history.push(reading);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  readingsByNode[input.nodeId] = history;
  updateDynamicAlerts();
  return reading;
}

function estimateWbgtC(temperatureC: number, humidityPct: number, radiantTemperatureC: number): number {
  const t = temperatureC;
  const rh = Math.max(1, Math.min(100, humidityPct));
  const wetBulb =
    t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) -
    4.686035;
  return round(0.7 * wetBulb + 0.2 * radiantTemperatureC + 0.1 * temperatureC);
}

function estimateHeatIndexC(temperatureC: number, humidityPct: number): number {
  const fahrenheit = temperatureC * 1.8 + 32;
  if (fahrenheit < 80) return round(temperatureC);
  const rh = humidityPct;
  const heatIndexF =
    -42.379 +
    2.04901523 * fahrenheit +
    10.14333127 * rh -
    0.22475541 * fahrenheit * rh -
    0.00683783 * fahrenheit ** 2 -
    0.05481717 * rh ** 2 +
    0.00122874 * fahrenheit ** 2 * rh +
    0.00085282 * fahrenheit * rh ** 2 -
    0.00000199 * fahrenheit ** 2 * rh ** 2;
  return round((heatIndexF - 32) / 1.8);
}

export function triggerWorkerAction(input: {
  nodeId: string;
  action: WorkerActionType;
  recipient: string;
}): WorkerAction | undefined {
  const node = nodes.find((candidate) => candidate.id === input.nodeId);
  if (!node) return undefined;

  const actionText =
    input.action === "FAN_ON"
      ? "Cooling fan activated in DEMO MODE"
      : "A 20-minute shaded rest break was scheduled in DEMO MODE";
  const action: WorkerAction = {
    id: nextId("action"),
    nodeId: input.nodeId,
    action: input.action,
    recipient: input.recipient,
    message: `${actionText} for ${input.recipient} at ${node.location}, ${node.city}.`,
    status: "TRIGGERED",
    simulated: true,
    createdAt: new Date().toISOString(),
  };
  workerActions.unshift(action);
  if (workerActions.length > 20) workerActions.pop();
  return action;
}

/** Heat measures calculated from basic weather values (used by live data and Explore). */
export function heatMetrics(input: {
  temperatureC: number;
  humidityPct: number;
  windSpeedMps: number;
  shortwaveWm2: number;
}): { radiantTemperatureC: number; wbgtC: number; heatIndexC: number; riskLevel: RiskLevel } {
  // Radiant (globe) temperature is not measured by weather models. It is
  // estimated from sunlight: stronger sun and less wind means hotter surroundings.
  const radiantTemperatureC = round(
    input.temperatureC + ((input.shortwaveWm2 / 1000) * 12) / (1 + 0.15 * input.windSpeedMps),
  );
  const wbgtC = estimateWbgtC(input.temperatureC, input.humidityPct, radiantTemperatureC);
  return {
    radiantTemperatureC,
    wbgtC: round(wbgtC),
    heatIndexC: round(estimateHeatIndexC(input.temperatureC, input.humidityPct)),
    riskLevel: riskForWbgt(wbgtC),
  };
}

function nodeFromObservation(base: NodeSummary, obs: LiveObservation): NodeSummary {
  const metrics = heatMetrics(obs);
  return {
    ...base,
    temperatureC: round(obs.temperatureC),
    humidityPct: round(obs.humidityPct, 0),
    radiantTemperatureC: metrics.radiantTemperatureC,
    windSpeedMps: round(obs.windSpeedMps, 1),
    solarExposureLux: Math.round(obs.shortwaveWm2 * 110),
    wbgtC: metrics.wbgtC,
    heatIndexC: metrics.heatIndexC,
    riskLevel: metrics.riskLevel,
    updatedAt: obs.observedAt,
    source: "LIVE_WEATHER",
  };
}

export function getLiveTargets(): { id: string; latitude: number; longitude: number }[] {
  return nodes.map((node) => ({ id: node.id, latitude: node.latitude, longitude: node.longitude }));
}

/**
 * Replaces a node's generated values with real weather data.
 * Nodes that receive readings from a real device (EDGE_DEVICE) are left alone.
 */
export function applyLiveData(
  nodeId: string,
  data: { current: LiveObservation; past: LiveObservation[]; future: LiveObservation[] },
): void {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) return;
  const base = nodes[index];
  if (base.source === "EDGE_DEVICE") return;

  const wasLive = base.source === "LIVE_WEATHER";
  const updated = nodeFromObservation(base, data.current);
  nodes[index] = updated;

  if (!wasLive) {
    // First real data: swap the generated history for real hourly history.
    readingsByNode[nodeId] = data.past.map((obs) =>
      createReading(nodeFromObservation(base, obs), obs.observedAt),
    );
  }
  const history = readingsByNode[nodeId] ?? [];
  const last = history[history.length - 1];
  if (!last || last.observedAt !== data.current.observedAt) {
    history.push(createReading(updated, data.current.observedAt));
  }
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  readingsByNode[nodeId] = history;

  const hourAgo = Date.parse(data.current.observedAt) - 3_600_000;
  const previous = [...history].reverse().find((r) => Date.parse(r.observedAt) <= hourAgo);
  previousHourByNode[nodeId] = previous ?? history[0];

  liveSeriesByNode[nodeId] = [data.current, ...data.future];

  if (!demoAlertsRetired) {
    // The three starter alerts describe generated demo values.
    demoAlertsRetired = true;
    const keep = alerts.filter(
      (alert) => !["RADIANT_HEAT_ALERT", "WBGT_HIGH", "LOCAL_HEAT_GAP"].includes(alert.type),
    );
    alerts.splice(0, alerts.length, ...keep);
  }
  updateDynamicAlerts();
}
