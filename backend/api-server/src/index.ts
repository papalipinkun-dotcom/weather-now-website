import net from "node:net";
import "./lib/load-env";
import app from "./app";
import { logger } from "./lib/logger";
import { startLiveWeather } from "./lib/live-weather";

// Defaults to 8080 so no setup is needed locally. Set PORT to change it.
const rawPort = process.env["PORT"] ?? "8080";
const preferredPort = Number(rawPort);

if (Number.isNaN(preferredPort) || preferredPort <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function findAvailablePort(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(findAvailablePort(port + 1));
        return;
      }

      reject(error);
    });

    tester.listen(port, "127.0.0.1", () => {
      const address = tester.address();
      const nextPort = typeof address === "object" && address ? address.port : port;

      tester.close(() => resolve(nextPort));
    });
  });
}

const port = await findAvailablePort(preferredPort);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(
    { port, apiKeyConfigured: Boolean(process.env["API_KEY"]) },
    "Server listening",
  );
  startLiveWeather();
});
