import { httpError } from "./errors.js";

function ensureAt(tag) {
  if (!tag) return tag;
  return tag.startsWith("@") ? tag : `@${tag}`;
}

function fontDestination(fontAssetKey, fontDir) {
  const base = String(fontAssetKey).split("/").pop();
  return `${fontDir}/${base}`;
}

export function buildCsvDefinition({ card, background, ornament, name, message }) {
  const bgTag = ensureAt(card.themes.indesignTag);
  const iconTag = ensureAt(card.personas.indesignTag);

  const headers = [bgTag, iconTag, "Message", "Name"];
  const rowObject = {
    [bgTag]: background.assetKey,
    [iconTag]: ornament.assetKey,
    Message: message,
    Name: name
  };

  return { headers, rowObject };
}

export function buildMergePayload({
  ornament,
  background,
  template,
  csvAssetKey,
  presigned,
  templateFonts,
  fontDir
}) {
  const findUrl = (type, assetKey) => presigned.find((x) => x.type === type && x.assetKey === assetKey)?.url;

  const iconUrl = findUrl("icon", ornament.assetKey);
  const bgUrl = findUrl("background", background.assetKey);
  const templateUrl = findUrl("template", template.assetKey);
  const csvUrl = findUrl("csv", csvAssetKey);

  if (!iconUrl || !bgUrl || !templateUrl || !csvUrl) {
    throw httpError("Failed to presign bg/icon/template/csv", 502);
  }

  const assets = [
    { destination: ornament.assetKey, source: { url: iconUrl } },
    { destination: background.assetKey, source: { url: bgUrl } },
    { destination: template.assetKey, source: { url: templateUrl } },
    { destination: csvAssetKey, source: { url: csvUrl } }
  ];

  for (const fontKey of templateFonts) {
    const fontUrl = findUrl("font", fontKey);
    if (!fontUrl) throw httpError(`Failed to presign font ${fontKey}`, 502);
    assets.push({
      destination: fontDestination(fontKey, fontDir),
      source: { url: fontUrl }
    });
  }

  const params = {
    dataSource: csvAssetKey,
    imagePlacementOptions: { fittingOption: "honor_existing_style" },
    exportSettings: { quality: "maximum", resolution: 72 },
    outputMediaType: "image/jpeg",
    targetDocument: template.assetKey,
    generalSettings: {
      fonts: { fontsDirectories: [fontDir] }
    }
  };

  return { assets, params, csvUrl };
}