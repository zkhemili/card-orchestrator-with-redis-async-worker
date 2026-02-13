import dotenv from "dotenv";

export function loadEnv() {
  dotenv.config();

  const env = {
    PORT: process.env.PORT || 8080,
    CONFIG_PATH: process.env.CONFIG_PATH || "./config.json",

    // cc-s3
    S3_API_BASE: process.env.S3_API_BASE || "https://api.cc-s3.net",
    S3_API_KEY: process.env.S3_API_KEY || "",
    CSV_PREFIX: process.env.CSV_PREFIX || "",
    CSV_USE_PREFIX: String(process.env.CSV_USE_PREFIX || "false").toLowerCase() === "true",

    // Adobe
    ADOBE_CLIENT_ID: process.env.ADOBE_CLIENT_ID || "",
    ADOBE_CLIENT_SECRET: process.env.ADOBE_CLIENT_SECRET || "",

    // Polling
    POLL_INTERVAL_MS: Number(process.env.POLL_INTERVAL_MS || 2000),
    POLL_TIMEOUT_MS: Number(process.env.POLL_TIMEOUT_MS || 120000),

    // Fonts
    FONT_DEST_DIR: process.env.FONT_DEST_DIR || "fonts",

    // Logging
    LOG_LEVEL: (process.env.LOG_LEVEL || "info").toLowerCase(),
    LOG_SAMPLE_RATE: Number(process.env.LOG_SAMPLE_RATE || 1),

    // Redis/Queue
    REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
    QUEUE_NAME: process.env.QUEUE_NAME || "card-orchestrator",
    JOB_PREFIX: process.env.JOB_PREFIX || "job:",
    JOB_TTL_SECONDS: Number(process.env.JOB_TTL_SECONDS || 86400),
  };

  const missing = [];
  if (!env.S3_API_KEY) missing.push("S3_API_KEY");
  if (!env.ADOBE_CLIENT_ID) missing.push("ADOBE_CLIENT_ID");
  if (!env.ADOBE_CLIENT_SECRET) missing.push("ADOBE_CLIENT_SECRET");
  if (!env.REDIS_URL) missing.push("REDIS_URL");

  if (missing.length) {
    throw new Error(`Missing required env var(s): ${missing.join(", ")}`);
  }

  return env;
}