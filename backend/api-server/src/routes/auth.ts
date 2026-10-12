import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  defaultCountryCode,
  getAuthSecret,
  isProduction,
} from "../lib/auth-config";
import { DeliveryError, deliverCode } from "../lib/delivery";
import { maskIdentity, parseIdentifier } from "../lib/identity";
import { logger } from "../lib/logger";
import { discardCode, issueCode, verifyCode } from "../lib/otp";
import { allow } from "../lib/rate-limit";
import { readSession, signSession } from "../lib/session";
import { findUserById, publicUser, signInUser } from "../lib/users";

const router: IRouter = Router();

const RequestBody = z.object({ identifier: z.string().min(3).max(254) });
const VerifyBody = z.object({
  identifier: z.string().min(3).max(254),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().max(60).optional(),
});

const TEN_MINUTES = 10 * 60 * 1000;

// Step 1: ask for a code by email or mobile number.
router.post("/request-otp", async (req, res) => {
  if (!allow(`req:${req.ip ?? "?"}`, 8, TEN_MINUTES)) {
    res.status(429).json({ error: "Too many requests. Please wait a few minutes." });
    return;
  }

  const body = RequestBody.safeParse(req.body);
  const identity = body.success
    ? parseIdentifier(body.data.identifier, defaultCountryCode())
    : null;
  if (!identity) {
    res.status(400).json({ error: "Enter a valid email address or mobile number." });
    return;
  }

  const key = `${identity.channel}:${identity.value}`;
  const issued = issueCode(getAuthSecret(), key);
  if (!issued.ok) {
    res.status(429).json({
      error: `Please wait ${issued.retryAfterSec}s before asking for another code.`,
      retryAfterSec: issued.retryAfterSec,
    });
    return;
  }

  try {
    const mode = await deliverCode(identity, issued.code);
    res.json({
      channel: identity.channel,
      destination: maskIdentity(identity),
      expiresInSec: issued.expiresInSec,
      // Only present in local demo mode, when no email/SMS provider is set up.
      ...(mode === "console" ? { devCode: issued.code } : {}),
    });
  } catch (err) {
    discardCode(key);
    logger.error({ err }, "Could not deliver sign-in code");
    const message =
      err instanceof DeliveryError && isProduction()
        ? "We could not send the code right now. Please try again later."
        : err instanceof Error
          ? err.message
          : "Could not send the code.";
    res.status(502).json({ error: message });
  }
});

// Step 2: check the code, then sign in (creating the account on first use).
router.post("/verify-otp", (req, res) => {
  if (!allow(`verify:${req.ip ?? "?"}`, 20, TEN_MINUTES)) {
    res.status(429).json({ error: "Too many attempts. Please wait a few minutes." });
    return;
  }

  const body = VerifyBody.safeParse(req.body);
  const identity = body.success
    ? parseIdentifier(body.data.identifier, defaultCountryCode())
    : null;
  if (!body.success || !identity) {
    res.status(400).json({ error: "Enter the 6-digit code we sent you." });
    return;
  }

  const result = verifyCode(
    getAuthSecret(),
    `${identity.channel}:${identity.value}`,
    body.data.code,
  );
  if (result !== "ok") {
    const messages = {
      invalid: "That code is not correct. Please try again.",
      expired: "That code has expired. Please ask for a new one.",
      locked: "Too many wrong attempts. Please ask for a new code.",
    } as const;
    res.status(401).json({ error: messages[result] });
    return;
  }

  const user = signInUser(identity, body.data.name);
  const maxAgeMs = SESSION_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(SESSION_COOKIE, signSession(getAuthSecret(), { uid: user.id, exp: Date.now() + maxAgeMs }), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    maxAge: maxAgeMs,
    path: "/",
  });
  res.json({ user: publicUser(user) });
});

// Who is signed in right now?
router.get("/me", (req, res) => {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const session = readSession(getAuthSecret(), cookies?.[SESSION_COOKIE]);
  const user = session ? findUserById(session.uid) : undefined;
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  res.json({ user: publicUser(user) });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;
