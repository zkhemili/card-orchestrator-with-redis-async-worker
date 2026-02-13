import { measure } from "./timing.js";
import { selectAssets } from "./assetSelect.js";
import { buildCsvDefinition, buildMergePayload } from "./mergePayload.js";
import { buildOneRowCsvBuffer, guessContentType } from "./csv.js";

function buildCsvAssetKey({ usePrefix, prefix }) {
  const fileName = `merge_${Date.now()}.csv`;
  if (!usePrefix || !prefix) return fileName;
  return `${prefix.replace(/\/+$/, "")}/${fileName}`;
}

async function presignAll({ ccS3, background, ornament, template, csvAssetKey, templateFonts }) {
  const targets = [
    { type: "background", assetKey: background.assetKey },
    { type: "icon", assetKey: ornament.assetKey },
    { type: "template", assetKey: template.assetKey },
    { type: "csv", assetKey: csvAssetKey },
    ...templateFonts.map((f) => ({ type: "font", assetKey: f }))
  ];

  const urls = await Promise.all(targets.map((t) => ccS3.getDownloadUri(t.assetKey)));
  return targets.map((t, i) => ({ ...t, url: urls[i] }));
}

export async function generateCard({
  cfg,
  env,
  ccS3,
  adobe,
  input,          // { cardId, persona, theme, locale, name, message }
  log
}) {
  const timings = {};

  const { cardId, persona, theme, locale = "ar", name = "", message = "" } = input;

  // 1) choose assets
  const { card, ornament, background, template, templateFonts } = await measure(
    "selectAssets",
    () => selectAssets({ cfg, cardId, persona, theme, locale }),
    timings
  );

  // 2) build CSV
  const { headers, rowObject } = buildCsvDefinition({
    card,
    background,
    ornament,
    name,
    message
  });

  const csvBuffer = await measure(
    "csv.buildBuffer",
    () => buildOneRowCsvBuffer({ headers, rowObject }),
    timings
  );

  const csvAssetKey = buildCsvAssetKey({
    usePrefix: env.CSV_USE_PREFIX,
    prefix: env.CSV_PREFIX
  });

  await measure("csv.upload", async () => {
    const uploadUri = await ccS3.getUploadUri(csvAssetKey);
    await ccS3.putToUploadUri(uploadUri, csvBuffer, guessContentType(csvAssetKey));
  }, timings);

  // 3) presign
  const presigned = await measure(
    "s3.getDownloadUrls",
    () => presignAll({ ccS3, background, ornament, template, csvAssetKey, templateFonts }),
    timings
  );

  // 4) build merge payload
  const { assets, params } = buildMergePayload({
    ornament,
    background,
    template,
    csvAssetKey,
    presigned,
    templateFonts,
    fontDir: env.FONT_DEST_DIR
  });

  // 5) adobe token + submit + poll
  const accessToken = await measure("adobe.getToken", () => adobe.getAccessToken(), timings);

  const job = await measure(
    "adobe.submitMerge",
    () => adobe.submitMerge({ assets, params, accessToken }),
    timings
  );

  const result = await measure(
    "adobe.pollStatus",
    () =>
      adobe.pollStatus(job.statusUrl, accessToken, {
        intervalMs: env.POLL_INTERVAL_MS,
        timeoutMs: env.POLL_TIMEOUT_MS
      }),
    timings
  );

  const mergedUrl = result?.outputs?.[0]?.destination?.url;

  if (!mergedUrl) {
    const err = new Error("No output URL returned from merge result");
    err.details = { job, result };
    throw err;
  }

  log?.("info", "generate.pipeline.succeeded", {
    cardId,
    persona,
    theme,
    locale,
    jobId: job?.jobId,
    timings
  });

  return {
    outputUrl: mergedUrl,
    timings,
    selection: {
      cardId,
      persona,
      theme,
      locale,
      template: { assetKey: template.assetKey, fonts: templateFonts },
      ornament,
      background
    },
    csv: { assetKey: csvAssetKey, headers, rowObject },
    adobeJob: job
  };
}