// Loads backend/api-server/.env (if the file exists) into process.env.
// Imported first in index.ts so values are ready before anything else reads them.
// Variables already set in the terminal take priority over the file.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Once built, this file lives in backend/api-server/dist/, so ".." is the api-server folder.
const envFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".env",
);

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
