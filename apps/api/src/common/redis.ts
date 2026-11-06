import Redis from 'ioredis';

let client: Redis | null | undefined;

export function redis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL;
  if (!url) {
    client = null;
    return null;
  }
  client = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  client.on('error', () => {});
  return client;
}

/** Returns hit count, or null if Redis is down (caller must use in-memory fallback). */
export async function rateIncr(key: string, windowSec: number): Promise<number | null> {
  const r = redis();
  if (!r) return null;
  try {
    const n = await r.incr(key);
    if (n === 1) await r.expire(key, windowSec);
    return n;
  } catch {
    return null;
  }
}

export async function rateGet(key: string): Promise<number | null> {
  const r = redis();
  if (!r) return null;
  try {
    const v = await r.get(key);
    return v == null ? 0 : Number(v) || 0;
  } catch {
    return null;
  }
}

export async function throttleOnce(key: string, ttlSec: number): Promise<boolean> {
  const r = redis();
  if (!r) return true;
  try {
    const ok = await r.set(key, '1', 'EX', ttlSec, 'NX');
    return ok === 'OK';
  } catch {
    return true;
  }
}
