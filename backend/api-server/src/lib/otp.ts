import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_AFTER_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

interface Entry {
  hash: string;
  expiresAt: number;
  attempts: number;
  sentAt: number;
}

// One-time codes live in memory only (never written to disk) and only as hashes.
const entries = new Map<string, Entry>();

function hashCode(secret: string, key: string, code: string): string {
  return createHmac("sha256", secret).update(`${key}:${code}`).digest("hex");
}

export type IssueResult =
  | { ok: true; code: string; expiresInSec: number }
  | { ok: false; retryAfterSec: number };

export function issueCode(
  secret: string,
  key: string,
  now: number = Date.now(),
): IssueResult {
  const existing = entries.get(key);
  if (existing && now - existing.sentAt < RESEND_AFTER_MS) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((RESEND_AFTER_MS - (now - existing.sentAt)) / 1000),
    };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  entries.set(key, {
    hash: hashCode(secret, key, code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    sentAt: now,
  });
  return { ok: true, code, expiresInSec: CODE_TTL_MS / 1000 };
}

/** Forget a code, for example when sending it failed. */
export function discardCode(key: string): void {
  entries.delete(key);
}

export type VerifyResult = "ok" | "invalid" | "expired" | "locked";

export function verifyCode(
  secret: string,
  key: string,
  code: string,
  now: number = Date.now(),
): VerifyResult {
  const entry = entries.get(key);
  if (!entry || now > entry.expiresAt) {
    entries.delete(key);
    return "expired";
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    entries.delete(key);
    return "locked";
  }

  entry.attempts += 1;
  const given = Buffer.from(hashCode(secret, key, code));
  const wanted = Buffer.from(entry.hash);
  if (given.length === wanted.length && timingSafeEqual(given, wanted)) {
    entries.delete(key);
    return "ok";
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    entries.delete(key);
    return "locked";
  }
  return "invalid";
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (now > entry.expiresAt) entries.delete(key);
  }
}, 60_000).unref();
