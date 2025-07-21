import Redis from 'ioredis';

const LOCK_TTL = 10000; // 10 seconds

export function createRedisClient(url: string): Redis {
  return new Redis(url);
}

export async function withAddressLock<T>(redis: Redis, address: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = `lock:address:${address}`;
  const lockValue = Math.random().toString(36).slice(2);

  try {
    const acquired = await redis.set(lockKey, lockValue, 'PX', LOCK_TTL, 'NX');
    if (!acquired) {
      throw new Error(`Could not acquire lock for address ${address}`);
    }
    return await fn();
  } finally {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(script, 1, lockKey, lockValue);
  }
}

export async function setCache(redis: Redis, key: string, value: any, ttlSeconds?: number): Promise<void> {
  const cacheKey = `cache:${key}`;
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.set(cacheKey, serialized, 'EX', ttlSeconds);
  } else {
    await redis.set(cacheKey, serialized);
  }
}

export async function getCache<T>(redis: Redis, key: string): Promise<T | null> {
  const cacheKey = `cache:${key}`;
  const data = await redis.get(cacheKey);
  if (data) return JSON.parse(data) as T;
  return null;
}

export async function delCache(redis: Redis, key: string): Promise<void> {
  const cacheKey = `cache:${key}`;
  await redis.del(cacheKey);
} 