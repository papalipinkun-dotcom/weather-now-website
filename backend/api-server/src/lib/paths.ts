import path from "node:path";
import { fileURLToPath } from "node:url";

// Once built, all code is bundled into backend/api-server/dist/index.mjs,
// so ".." from this file's location is the api-server folder.
export const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// Users and the auto-generated session secret are stored here (git-ignored).
// Set DATA_DIR to a persistent disk folder when hosting (default: ./data).
export const dataDir = process.env["DATA_DIR"]
  ? path.resolve(process.env["DATA_DIR"])
  : path.join(serverRoot, "data");
