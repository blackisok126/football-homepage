import { readFile } from "node:fs/promises";
import { SOURCE_STATUS } from "../types.js";
import { adaptLegacyPayload } from "../matchAdapter.js";

const LEGACY_DATA_URL = new URL("../../../../data/matches.json", import.meta.url);

export async function getLocalChineseProviderRecords() {
  const rawText = await readFile(LEGACY_DATA_URL, "utf8");
  const payload = JSON.parse(rawText);
  const updatedAt = new Date().toISOString();
  const matches = adaptLegacyPayload(payload, {
    source: payload.source || "local-chinese-cache",
    sourceStatus: SOURCE_STATUS.CACHE,
    updatedAt,
  });

  return {
    source: "local-chinese-cache",
    sourceStatus: SOURCE_STATUS.CACHE,
    updatedAt,
    records: matches.map((match) => ({
      match,
      raw: payload.matches?.find((legacyMatch) => match.homeTeam === legacyMatch.homeTeam) || null,
    })),
    raw: payload,
  };
}
