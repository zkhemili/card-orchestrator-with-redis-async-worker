import { httpError } from "./errors.js";
import { findCard } from "./config.js";

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

function findOptionByName(options, name, kind) {
  const obj = options.find((o) => o.name === name);
  if (!obj) throw httpError(`Unknown ${kind}: ${name}`, 400);
  return obj;
}

function pickTemplate(card, locale) {
  const match = card.template?.find((t) => t.locale === locale);
  return match || card.template?.[0];
}

export function selectAssets({ cfg, cardId, persona, theme, locale }) {
  const card = findCard(cfg, cardId);

  const personaObj = findOptionByName(card.personas.options, persona, "persona");
  if (!personaObj?.ornaments?.length) throw httpError(`No ornaments for persona: ${persona}`, 400);
  const ornament = pickRandom(personaObj.ornaments);

  const themeObj = findOptionByName(card.themes.options, theme, "theme");
  if (!themeObj?.backgrounds?.length) throw httpError(`No backgrounds for theme: ${theme}`, 400);
  const background = pickRandom(themeObj.backgrounds);

  const template = pickTemplate(card, locale);
  if (!template?.assetKey) throw httpError(`No template found for locale: ${locale}`, 400);

  const templateFonts = Array.isArray(template.fonts) ? template.fonts : [];

  return { card, ornament, background, template, templateFonts };
}