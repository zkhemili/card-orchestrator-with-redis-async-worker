// ================= Core =================
import express from "express";
import crypto from "crypto";

// ================= Environment + Config =================
import { loadEnv } from "./lib/env.js";
import { loadConfig } from "./lib/config.js";

// ================= Logging + Timing =================
import { createJsonlLogger } from "./lib/logger.js";
import { nowMs } from "./lib/timing.js";

// ================= Redis + Queue =================
import { createRedis } from "./lib/redis.js";
import { createQueue } from "./lib/queue.js";

// ================= External Clients =================
import { createCcS3Client } from "./lib/ccS3Client.js";
import { createAdobeClient } from "./lib/adobeClient.js";

// ================= Routes =================
import { createGenerateRoute } from "./routes/generate.js";
import { createGenerateAsyncRoute } from "./routes/generateAsync.js";
import { createJobStatusRoute } from "./routes/jobStatus.js";

// ======================================================
// Bootstrap
// ======================================================

const env = loadEnv();

const logger = createJsonlLogger({
  level: env.LOG_LEVEL,
  sampleRate: env.LOG_SAMPLE_RATE
});
const log = logger.log;

const cfg = loadConfig(env.CONFIG_PATH);

// External service clients
const ccS3 = createCcS3Client({
  baseUrl: env.S3_API_BASE,
  apiKey: env.S3_API_KEY
});

const adobe = createAdobeClient({
  clientId: env.ADOBE_CLIENT_ID,
  clientSecret: env.ADOBE_CLIENT_SECRET
});

// Redis + Queue
const redis = createRedis(env);
const queue = createQueue(env, redis);

// ======================================================
// Express App
// ======================================================

const app = express();
app.use(express.json({ limit: "4mb" }));

// Request tracing + sampled request logs
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  req._t0 = nowMs();
  req._sampleLog = logger.shouldSample();

  res.setHeader("x-request-id", req.requestId);

  res.on("finish", () => {
    if (!req._sampleLog) return;
    const durationMs = +(nowMs() - req._t0).toFixed(2);

    log("info", "request.completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs
    });
  });

  next();
});

// ======================================================
// Routes
// ======================================================

app.get("/health", (_req, res) => res.json({ ok: true }));

// Sync route
app.post(
  "/generate",
  createGenerateRoute({
    cfg,
    env,
    ccS3,
    adobe,
    log
  })
);

// Async route
app.post(
  "/generate-async",
  createGenerateAsyncRoute({
    env,
    redis,
    queue,
    log
  })
);

app.get(
  "/jobs/:jobId",
  createJobStatusRoute({
    env,
    redis
  })
);

// ======================================================

app.listen(env.PORT, () => {
  console.log(`Card Orchestrator running on :${env.PORT}`);
  console.log(`Loaded config: ${env.CONFIG_PATH}`);
});