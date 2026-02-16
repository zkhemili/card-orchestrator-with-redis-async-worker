import { httpError, getStatusCode } from "../lib/errors.js";
import { createQueuedJob, getJob } from "../lib/jobStore.js";

function isJobExistsError(err) {
  const msg = String(err?.message || "");
  return msg.toLowerCase().includes("already exists");
}

export function createGenerateAsyncRoute({ env, redis, queue, log }) {
  return async function generateAsync(req, res) {
    try {
      const {
        sessionId,
        requestId,
        cardId,
        persona,
        theme,
        locale = "ar",
        name = "",
        message = ""
      } = req.body || {};

      if (!cardId || !persona || !theme || !requestId) {
        throw httpError("cardId, persona, theme, requestId are required", 400);
      }

      // Use requestId as jobId for idempotency
      const jobId = requestId;

      // ✅ If job already exists, return existing status (idempotent)
      const existing = await getJob(redis, env, jobId);
      if (existing) {
        return res.status(202).json({
          jobId,
          status: existing.status || "queued"
        });
      }

      // Persist job status in Redis hash
      await createQueuedJob(redis, env, {
        jobId,
        sessionId,
        cardId,
        persona,
        theme,
        locale,
        name,
        message
      });

      // Enqueue in BullMQ
      try {
        await queue.add(
          "generate-card",
          { jobId },
          {
            jobId,
            attempts: 3,
            backoff: { type: "exponential", delay: 3000 }, // ~3s, 6s, 12s
            removeOnComplete: 1000,
            removeOnFail: 5000
          }
        );
      } catch (err) {
        // ✅ If a race caused the job to already exist, treat as idempotent success
        if (!isJobExistsError(err)) throw err;
      }

      log?.("info", "job.queued", { jobId, sessionId, cardId, persona, theme, locale });

      return res.status(202).json({ jobId, status: "queued" });
    } catch (e) {
      const status = getStatusCode(e);
      log?.("error", "generateAsync.error", {
        error: e?.message || String(e),
        statusCode: status
      });
      return res.status(status).json({ error: e?.message || String(e), details: e?.details });
    }
  };
}