import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { ExploreError } from "../lib/explore";
import { getAreaGrid, getPointDetail } from "../lib/map-weather";
import { allow } from "../lib/rate-limit";

const router: IRouter = Router();
const TEN_MINUTES = 10 * 60 * 1000;

const decimal = (min: number, max: number) =>
  z.string().regex(/^-?\d{1,3}(\.\d+)?$/).transform(Number).pipe(z.number().min(min).max(max));

const AreaQuery = z.object({
  south: decimal(-90, 90),
  north: decimal(-90, 90),
  west: decimal(-180, 180),
  east: decimal(-180, 180),
  size: z.enum(["5", "6", "7"]).default("6").transform(Number),
});
const PointQuery = z.object({ lat: decimal(-90, 90), lon: decimal(-180, 180) });

function fail(res: Response, err: unknown, fallback: string) {
  const status = err instanceof ExploreError ? err.status : 502;
  res.status(status).json({ error: err instanceof ExploreError ? err.message : fallback });
}

// Temperatures on a grid across the visible part of the map.
router.get("/map/area", async (req, res) => {
  if (!allow(`map-area:${req.ip ?? "?"}`, 40, TEN_MINUTES)) {
    res.status(429).json({ error: "Too many map updates. Please wait a few minutes." });
    return;
  }
  const q = AreaQuery.safeParse(req.query);
  if (!q.success || q.data.north <= q.data.south || q.data.east <= q.data.west) {
    res.status(400).json({ error: "Invalid map area." });
    return;
  }
  // A whole-world view makes no sense for a 6x6 grid, so cap how big an area can be.
  if (q.data.north - q.data.south > 60 || q.data.east - q.data.west > 90) {
    res.status(400).json({ error: "Zoom in a little to see the temperature colours." });
    return;
  }
  try {
    const { south, west, north, east, size } = q.data;
    res.json({ size, points: await getAreaGrid(south, west, north, east, size) });
  } catch (err) {
    req.log.warn({ err }, "Map area request failed");
    fail(res, err, "Could not load the map weather.");
  }
});

// Full detail for one spot the person clicked.
router.get("/map/point", async (req, res) => {
  if (!allow(`map-point:${req.ip ?? "?"}`, 80, TEN_MINUTES)) {
    res.status(429).json({ error: "Too many requests. Please wait a few minutes." });
    return;
  }
  const q = PointQuery.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: "Invalid location." });
    return;
  }
  try {
    res.json(await getPointDetail(q.data.lat, q.data.lon));
  } catch (err) {
    req.log.warn({ err }, "Map point request failed");
    fail(res, err, "Could not load weather for that spot.");
  }
});

export default router;
