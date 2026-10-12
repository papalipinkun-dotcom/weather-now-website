import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, getAuthSecret } from "../lib/auth-config";
import { readSession } from "../lib/session";
import { findUserById } from "../lib/users";

/** Blocks the request with 401 unless it carries a valid sign-in cookie. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const session = readSession(getAuthSecret(), cookies?.[SESSION_COOKIE]);
  const user = session ? findUserById(session.uid) : undefined;

  if (!user) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }

  res.locals["user"] = user;
  next();
}
