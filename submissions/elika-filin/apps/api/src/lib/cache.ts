export interface TtlCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

/** In-memory cache on an injected clock, so the TTL is asserted without waiting. */
export function createTtlCache<T>({ ttlMs, now }: { ttlMs: number; now: () => number }): TtlCache<T> {
  const entries = new Map<string, { storedAt: number; value: T }>();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.storedAt + ttlMs <= now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      entries.set(key, { storedAt: now(), value });
    },
  };
}
