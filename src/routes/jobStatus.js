import { getStatusCode } from "../lib/errors.js";
import { getJob } from "../lib/jobStore.js";

export function createJobStatusRoute({ env, redis }) {
  return async function jobStatus(req, res) {
    try {
      const { jobId } = req.params;
      const job = await getJob(redis, env, jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      return res.json(job);
    } catch (e) {
      const status = getStatusCode(e);
      return res.status(status).json({ error: e?.message || String(e) });
    }
  };
}