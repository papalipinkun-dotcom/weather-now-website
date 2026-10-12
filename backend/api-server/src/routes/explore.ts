import { Router, type IRouter } from "express";
import { z } from "zod";
import { ExploreError, getDayWeather, searchPlaces, validateDate } from "../lib/explore";
import { allow } from "../lib/rate-limit";

const router: IRouter = Router();
const TEN_MINUTES = 10 * 60 * 1000;

const coordinate = (min: number, max: number) =>
  z
    .string()
    .regex(/^-?\d{1,3}(\.\d+)?$/)
    .transform(Number)
    .pipe(z.number().min(min).max(max));

const SearchQuery = z.object({ q: z.string().trim().min(2).max(80), world: z.enum(["0", "1"]).optional() });
const WeatherQuery = z.object({
  lat: coordinate(-90, 90),
  lon: coordinate(-180, 180),
  date: z.string().refine((value) => validateDate(value), "Pick a date from 1940 to 15 days ahead."),
});

// Search for a place by name (city, area, landmark).
router.get("/places/search", async (req, res) => {
  if (!allow(`places:${req.ip ?? "?"}`, 60, TEN_MINUTES)) {
    res.status(429).json({ error: "Too many searches. Please wait a few minutes." });
    return;
  }
  const query = SearchQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Type at least 2 letters of a place name." });
    return;
  }
  try {
    res.json({ places: await searchPlaces(query.data.q, query.data.world !== "1") });
  } catch (err) {
    const status = err instanceof ExploreError ? err.status : 502;
    res.status(status).json({ error: err instanceof ExploreError ? err.message : "Search failed." });
  }
});

// Real weather, hour by hour, for one place and one date.
router.get("/explore", async (req, res) => {
  if (!allow(`explore:${req.ip ?? "?"}`, 90, TEN_MINUTES)) {
    res.status(429).json({ error: "Too many requests. Please wait a few minutes." });
    return;
  }
  const query = WeatherQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Choose a place and a date from 1940 to 15 days ahead." });
    return;
  }
  try {
    res.json(await getDayWeather(query.data.lat, query.data.lon, query.data.date));
  } catch (err) {
    const status = err instanceof ExploreError ? err.status : 502;
    req.log.warn({ err }, "Explore request failed");
    res.status(status).json({ error: err instanceof ExploreError ? err.message : "Could not load weather." });
  }
});

export default router;
