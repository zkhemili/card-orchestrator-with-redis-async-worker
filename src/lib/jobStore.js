export function jobKey(env, jobId) {
  return `${env.JOB_PREFIX}${jobId}`;
}

export async function createQueuedJob(redis, env, payload) {
  const { jobId, sessionId, cardId, persona, theme, locale, name, message } = payload;
  const key = jobKey(env, jobId);

  const now = Date.now();

  // Store status hash
  await redis.hset(key, {
    jobId,
    sessionId: sessionId || "",
    cardId,
    persona,
    theme,
    locale: locale || "",
    name: name || "",
    message: message || "",
    status: "queued",
    createdAt: String(now),
    updatedAt: String(now)
  });

  // TTL so Redis doesn’t grow forever
  await redis.expire(key, env.JOB_TTL_SECONDS);

  return key;
}

export async function updateJobStatus(redis, env, jobId, patch) {
  const key = jobKey(env, jobId);
  const now = Date.now();

  const toWrite = {
    ...Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, v === undefined || v === null ? "" : String(v)])
    ),
    updatedAt: String(now)
  };

  await redis.hset(key, toWrite);
  return key;
}

export async function getJob(redis, env, jobId) {
  const key = jobKey(env, jobId);
  const data = await redis.hgetall(key);
  return Object.keys(data).length ? data : null;
}