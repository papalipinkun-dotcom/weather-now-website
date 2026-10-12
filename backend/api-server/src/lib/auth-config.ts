import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./paths";

export const SESSION_COOKIE = "wn_session";
export const SESSION_DAYS = 7;

export const isProduction = (): boolean => process.env["NODE_ENV"] === "production";

/** Country code added to phone numbers typed without "+". Default: India. */
export function defaultCountryCode(): string {
  const raw = (process.env["DEFAULT_COUNTRY_CODE"] ?? "+91").trim();
  return /^\+[1-9]\d{0,3}$/.test(raw) ? raw : "+91";
}

let cachedSecret: string | null = null;

/**
 * Secret used to sign sessions and hash one-time codes.
 * Set AUTH_SECRET in .env. If it is missing (local use only) one is generated
 * once and kept in backend/api-server/data/.auth-secret so sessions survive restarts.
 */
export function getAuthSecret(): string {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env["AUTH_SECRET"];
  if (fromEnv && fromEnv.length >= 16) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }
  if (isProduction()) {
    throw new Error("AUTH_SECRET (at least 16 characters) is required in production.");
  }

  const file = path.join(dataDir, ".auth-secret");
  if (existsSync(file)) {
    cachedSecret = readFileSync(file, "utf8").trim();
  } else {
    cachedSecret = randomBytes(32).toString("hex");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}
