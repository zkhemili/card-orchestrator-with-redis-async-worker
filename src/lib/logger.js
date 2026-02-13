export function createJsonlLogger({
  level = "info",
  sampleRate = 1,
  sink = process.stdout
} = {}) {
  const LEVELS = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10 };
  const minLevel = LEVELS[String(level).toLowerCase()] ?? 30;

  let queue = [];
  let scheduled = false;

  const shouldSample = () => {
    const r = Number(sampleRate);
    if (r >= 1) return true;
    if (r <= 0) return false;
    return Math.random() < r;
  };

  const flushSoon = () => {
    if (scheduled) return;
    scheduled = true;
    setImmediate(() => {
      scheduled = false;
      const batch = queue;
      queue = [];
      sink.write(batch.join(""));
    });
  };

  const log = (lvl, msg, fields) => {
    const numeric = LEVELS[lvl] ?? 30;
    if (numeric < minLevel) return;
    const entry = { ts: new Date().toISOString(), level: lvl, msg, ...(fields || {}) };
    queue.push(JSON.stringify(entry) + "\n");
    flushSoon();
  };

  return { log, shouldSample };
}