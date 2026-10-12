import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { existsSync } from "node:fs";
import path from "node:path";
import { isProduction } from "./lib/auth-config";
import { serverRoot } from "./lib/paths";

const app: Express = express();

// Hosts such as Render put a proxy in front of the server. Trust it so the
// real visitor IP is used for rate limits and HTTPS cookies work.
if (isProduction()) app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the built website from the same server (used when hosting online).
// Build it first: pnpm --filter @workspace/web-app run build
const webDist =
  process.env["WEB_DIST"] ??
  path.resolve(serverRoot, "..", "..", "frontend", "web-app", "dist", "public");
if (existsSync(path.join(webDist, "index.html"))) {
  app.use(express.static(webDist));
  // Any other page address returns the app, so links like /login still load.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(webDist, "index.html"));
  });
}

export default app;
