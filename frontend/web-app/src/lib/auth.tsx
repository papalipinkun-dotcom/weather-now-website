import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface AuthUser { id: string; name: string; email?: string; phone?: string }
export interface OtpRequestResult { channel: 'email' | 'sms'; destination: string; expiresInSec: number; devCode?: string }

/** Fired by the data layer when the API answers 401 (for example an expired sign-in). */
export const UNAUTHORIZED_EVENT = 'weather-now:unauthorized';

class AuthApiError extends Error {
  readonly status: number;
  readonly retryAfterSec?: number;
  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

export function describeAuthError(err: unknown): { message: string; retryAfterSec?: number } {
  if (err instanceof AuthApiError) return { message: err.message, retryAfterSec: err.retryAfterSec };
  return { message: 'Could not reach the server. Make sure the API is running, then try again.' };
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/auth${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AuthApiError(
      typeof data.error === 'string' ? data.error : `Request failed (${res.status}).`,
      res.status,
      typeof data.retryAfterSec === 'number' ? data.retryAfterSec : undefined,
    );
  }
  return data as T;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: 'loading' | 'ready';
  requestOtp: (identifier: string) => Promise<OtpRequestResult>;
  verifyOtp: (identifier: string, code: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    call<{ user: AuthUser }>('GET', '/me')
      .then((data) => { if (!cancelled) setUser(data.user); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setStatus('ready'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => { queryClient.clear(); setUser(null); };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  const requestOtp = useCallback((identifier: string) => call<OtpRequestResult>('POST', '/request-otp', { identifier }), []);

  const verifyOtp = useCallback(async (identifier: string, code: string, name?: string) => {
    const data = await call<{ user: AuthUser }>('POST', '/verify-otp', { identifier, code, name: name?.trim() || undefined });
    queryClient.clear();
    setUser(data.user);
  }, [queryClient]);

  const logout = useCallback(async () => {
    try { await call<{ ok: boolean }>('POST', '/logout', {}); } catch { /* the cookie is cleared on the next successful call anyway */ }
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const value = useMemo(() => ({ user, status, requestOtp, verifyOtp, logout }), [user, status, requestOtp, verifyOtp, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
