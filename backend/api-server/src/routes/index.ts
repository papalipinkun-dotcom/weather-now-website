import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/require-auth";
import authRouter from "./auth";
import exploreRouter from "./explore";
import healthRouter from "./health";
import mapRouter from "./map";
import weatherRouter from "./weather";

const router: IRouter = Router();

// Public
router.use(healthRouter);
router.use("/auth", authRouter);

// Everything below needs a signed-in user. Sensor devices post readings
// without a browser session, so that one endpoint stays open.
router.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/sensor-data") {
    next();
    return;
  }
  requireAuth(req, res, next);
});
router.use(weatherRouter);
router.use(exploreRouter);
router.use(mapRouter);

export default router;
