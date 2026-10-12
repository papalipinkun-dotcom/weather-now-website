import { Router, type IRouter } from "express";
import {
  GetAlertsResponse,
  GetDashboardResponse,
  GetForecastParams,
  GetForecastResponse,
  GetHeatmapResponse,
  GetNodeParams,
  GetNodeReadingsParams,
  GetNodeReadingsResponse,
  GetNodeResponse,
  GetNodesResponse,
  GetSimulationResponse,
  IngestSensorDataBody,
  IngestSensorDataResponse,
  TriggerWorkerActionBody,
  TriggerWorkerActionResponse,
  UpdateAlertBody,
  UpdateAlertParams,
  UpdateAlertResponse,
  UpdateSimulationBody,
  UpdateSimulationResponse,
} from "@workspace/api-zod";
import {
  acknowledgeAlert,
  getDashboardSnapshot,
  getForecastSnapshot,
  getHeatAlerts,
  getHeatmapSnapshot,
  getNodeSummaries,
  getNodeSummary,
  getReadings,
  getSimulationState,
  ingestSensorReading,
  triggerWorkerAction,
  updateSimulationState,
} from "../lib/weather-state";

const router: IRouter = Router();

router.get("/dashboard", (_req, res) => {
  res.json(GetDashboardResponse.parse(getDashboardSnapshot()));
});

router.get("/nodes", (_req, res) => {
  res.json(GetNodesResponse.parse(getNodeSummaries()));
});

router.get("/nodes/:nodeId", (req, res) => {
  const params = GetNodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const node = getNodeSummary(params.data.nodeId);
  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.json(GetNodeResponse.parse(node));
});

router.get("/nodes/:nodeId/readings", (req, res) => {
  const params = GetNodeReadingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const readings = getReadings(params.data.nodeId);
  if (!readings) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.json(GetNodeReadingsResponse.parse(readings));
});

router.get("/heatmap", (_req, res) => {
  res.json(GetHeatmapResponse.parse(getHeatmapSnapshot()));
});

router.get("/forecast/:nodeId", (req, res) => {
  const params = GetForecastParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const forecast = getForecastSnapshot(params.data.nodeId);
  if (!forecast) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.json(GetForecastResponse.parse(forecast));
});

router.get("/alerts", (_req, res) => {
  res.json(GetAlertsResponse.parse(getHeatAlerts()));
});

router.patch("/alerts/:alertId", (req, res) => {
  const params = UpdateAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateAlertBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const alert = acknowledgeAlert(params.data.alertId);
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(UpdateAlertResponse.parse(alert));
});

router.post("/sensor-data", (req, res) => {
  const body = IngestSensorDataBody.safeParse(req.body);
  if (!body.success) {
    req.log.warn({ errors: body.error.message }, "Invalid sensor data payload");
    res.status(400).json({ error: body.error.message });
    return;
  }
  const reading = ingestSensorReading(body.data);
  if (!reading) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.status(201).json(IngestSensorDataResponse.parse(reading));
});

router.get("/simulation", (_req, res) => {
  res.json(GetSimulationResponse.parse(getSimulationState()));
});

router.patch("/simulation", (req, res) => {
  const body = UpdateSimulationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  res.json(UpdateSimulationResponse.parse(updateSimulationState(body.data)));
});

router.post("/actions", (req, res) => {
  const body = TriggerWorkerActionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const action = triggerWorkerAction(body.data);
  if (!action) {
    res.status(404).json({ error: "Node not found" });
    return;
  }
  res.status(201).json(TriggerWorkerActionResponse.parse(action));
});

export default router;