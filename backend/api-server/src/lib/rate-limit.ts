const hits = new Map<string, number[]>();

/** Returns true when the caller is still within `limit` hits per `windowMs`. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) {
    if (list.every((t) => now - t > 60 * 60 * 1000)) hits.delete(key);
  }
}, 10 * 60 * 1000).unref();
