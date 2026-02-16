import { Worker } from "bullmq";

// env + logging
import { loadEnv } from "../lib/env.js";
import { createJsonlLogger } from "../lib/logger.js";

// redis + job store
import { createRedis } from "../lib/redis.js";
import { getJob, updateJobStatus } from "../lib/jobStore.js";

// config + external clients
import { loadConfig } from "../lib/config.js";
import { createCcS3Client } from "../lib/ccS3Client.js";
import { createAdobeClient } from "../lib/adobeClient.js";

// shared pipeline
import { generateCard } from "../lib/generatePipeline.js";

const env = loadEnv();

const logger = createJsonlLogger({
  level: env.LOG_LEVEL,
  sampleRate: env.LOG_SAMPLE_RATE
});
const log = logger.log;

const redis = createRedis(env);

// Load config once (worker process lifetime)
const cfg = loadConfig(env.CONFIG_PATH);

// Create clients once
const ccS3 = createCcS3Client({ baseUrl: env.S3_API_BASE, apiKey: env.S3_API_KEY });
const adobe = createAdobeClient({ clientId: env.ADOBE_CLIENT_ID, clientSecret: env.ADOBE_CLIENT_SECRET });

async function processGenerate(bullJob) {
  const { jobId } = bullJob.data;

  // 1) mark processing
  await updateJobStatus(redis, env, jobId, { status: "processing" });

  // 2) read stored request data from Redis hash
  const stored = await getJob(redis, env, jobId);
  if (!stored) {
    throw new Error(`Job not found in Redis: ${jobId}`);
  }

  // 3) run pipeline
  const out = await generateCard({
    cfg,
    env,
    ccS3,
    adobe,
    input: {
      cardId: stored.cardId,
      persona: stored.persona,
      theme: stored.theme,
      locale: stored.locale || "ar",
      name: stored.name || "",
      message: stored.message || ""
    },
    log
  });

  // 4) persist success
  await updateJobStatus(redis, env, jobId, {
    status: "succeeded",
    outputUrl: out.outputUrl
  });

  return { ok: true, outputUrl: out.outputUrl };
}

function clampInt(value, { min, max, fallback }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

const concurrency = clampInt(process.env.WORKER_CONCURRENCY, { min: 1, max: 50, fallback: 5 });
const limiterMax = clampInt(process.env.WORKER_LIMITER_MAX, { min: 1, max: 10000, fallback: 150 });
const limiterDuration = clampInt(process.env.WORKER_LIMITER_DURATION_MS, { min: 1000, max: 600000, fallback: 60000 });
const worker = new Worker(env.QUEUE_NAME, processGenerate, {
  connection: redis,
  concurrency,
  limiter: {
    max: limiterMax,
    duration: limiterDuration
  }
});

worker.on("completed", (job, result) => {
  log("info", "worker.completed", { bullJobId: job.id, jobId: job.data?.jobId, outputUrl: result?.outputUrl });
});

worker.on("failed", async (job, err) => {
  const jobId = job?.data?.jobId;
  const attemptsMade = job?.attemptsMade ?? 0;
  const maxAttempts = job?.opts?.attempts ?? 1;

  const status = attemptsMade < maxAttempts ? "retrying" : "failed";

  await updateJobStatus(redis, env, jobId, {
    status,
    attemptsMade,
    error: err?.message || String(err),
    errorStack: err?.stack ? String(err.stack).slice(0, 4000) : ""
  });
});

console.log(`Worker listening on queue "${env.QUEUE_NAME}"`);