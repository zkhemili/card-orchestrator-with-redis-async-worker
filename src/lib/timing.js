import { performance } from "perf_hooks";

export const nowMs = () => performance.now();

export async function measure(stepName, fn, timings) {
  const t0 = nowMs();
  try {
    const out = await fn();
    timings[stepName] = +(nowMs() - t0).toFixed(2);
    return out;
  } catch (err) {
    timings[stepName] = +(nowMs() - t0).toFixed(2);
    throw err;
  }
}