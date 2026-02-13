import crypto from "crypto";
import { httpError, getStatusCode } from "../lib/errors.js";
import { createQueuedJob } from "../lib/jobStore.js";

export function createGenerateAsyncRoute({ env, redis, queue, log }) {
  return async function generateAsync(req, res) {
    try {
      const {
        sessionId,
        cardId,
        persona,
        theme,
        locale = "ar",
        name = "",
        message = ""
      } = req.body || {};


      if (!cardId || !persona || !theme) {
        throw httpError("cardId, persona, theme are required", 400);
      }

      const jobId = crypto.randomUUID();

      // Persist job status in Redis hash
      await createQueuedJob(redis, env, {
        jobId,
        sessionId,
        cardId,
        persona,
        theme,
        locale,
        name,
        message: message
      });

      // Enqueue in BullMQ
      // Use jobId as BullMQ jobId to prevent duplicates if client retries
      await queue.add(
        "generate-card",
        { jobId },
        {
          jobId,
          removeOnComplete: 1000,
          removeOnFail: 5000
        }
      );

      log?.("info", "job.queued", { jobId, sessionId, cardId, persona, theme, locale });

      return res.status(202).json({
        jobId,
        status: "queued"
      });
    } catch (e) {
      const status = getStatusCode(e);
      log?.("error", "generateAsync.error", { error: e?.message || String(e), statusCode: status });
      return res.status(status).json({ error: e?.message || String(e), details: e?.details });
    }
  };
}