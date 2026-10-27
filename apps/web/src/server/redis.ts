import { serverEnv } from "./env"

let client: Bun.RedisClient | undefined

export function redis() {
  return (client ??= new Bun.RedisClient(serverEnv().REDIS_URL))
}

/** Fixed-window rate limiter; throws once `limit` hits happen within `windowSecs`. */
export async function rateLimit(key: string, limit: number, windowSecs: number) {
  const bucket = `ratelimit:${key}:${Math.floor(Date.now() / 1000 / windowSecs)}`
  const count = await redis().incr(bucket)
  if (count === 1) await redis().expire(bucket, windowSecs)
  if (count > limit) {
    throw new Error("code:rateLimited")
  }
}

/** Caches the result of `produce` under `key` for `ttlSecs`. */
export async function cached(key: string, ttlSecs: number, produce: () => string) {
  const hit = await redis().get(key)
  if (hit) return hit
  const value = produce()
  await redis().set(key, value, "EX", ttlSecs)
  return value
}
