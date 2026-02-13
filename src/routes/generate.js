import crypto from "crypto";
import { nowMs } from "../lib/timing.js";
import { httpError, getStatusCode } from "../lib/errors.js";
import { generateCard } from "../lib/generatePipeline.js";

export function createGenerateRoute({ cfg, env, ccS3, adobe, log }) {
  return async function generateHandler(req, res) {
    const requestId = req.requestId || crypto.randomUUID();
    const timings = {};
    const t0 = nowMs();

    try {
      const { cardId, persona, theme, locale = "ar", name = "" } = req.body || {};
      const message = (req.body?.message ?? req.body?.msg ?? "");

      if (!cardId || !persona || !theme) {
        throw httpError("cardId, persona, theme are required", 400);
      }

      const result = await generateCard({
        cfg,
        env,
        ccS3,
        adobe,
        input: { cardId, persona, theme, locale, name, message },
        log
      });

      return res.json({
        status: "succeeded",
        output: { mediaType: "image/jpeg", url: result.outputUrl },
        selection: result.selection,
        csv: result.csv,
        timings: result.timings
      });
    } catch (e) {
      timings.total = +(nowMs() - t0).toFixed(2);
      const status = getStatusCode(e);

      log?.("error", "generate.error", {
        requestId,
        statusCode: status,
        error: e?.message || String(e)
      });

      return res.status(status).json({ error: e?.message || String(e), details: e?.details });
    }
  };
}