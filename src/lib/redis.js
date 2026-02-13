import IORedis from "ioredis";

export function createRedis(env) {
  // BullMQ recommends ioredis
  const redis = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // recommended for BullMQ
    enableReadyCheck: false
  });

  redis.on("error", (e) => {
    console.error("Redis error:", e?.message || e);
  });

  return redis;
}