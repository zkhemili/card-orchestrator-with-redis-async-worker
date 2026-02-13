import fs from "fs";

export function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed?.cards?.length) throw new Error(`Config missing "cards" array: ${configPath}`);
  return parsed;
}

export function findCard(cfg, cardId) {
  const card = cfg.cards.find((c) => c.cardId === cardId);
  if (!card) throw new Error(`Unknown cardId: ${cardId}`);
  return card;
}