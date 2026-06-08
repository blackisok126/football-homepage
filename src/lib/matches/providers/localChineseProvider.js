import { SOURCE_STATUS } from "../types.js";
import { adaptLegacyPayload } from "../matchAdapter.js";
import legacyPayload from "../../../../data/matches.json" with { type: "json" };

export async function getLocalChineseProviderRecords() {
  const updatedAt = new Date().toISOString();
  const matches = adaptLegacyPayload(legacyPayload, {
    source: legacyPayload.source || "local-chinese-cache",
    sourceStatus: SOURCE_STATUS.CACHE,
    updatedAt,
  });

  return {
    source: "local-chinese-cache",
    sourceStatus: SOURCE_STATUS.CACHE,
    updatedAt,
    records: matches.map((match) => ({
      match,
      raw:
        legacyPayload.matches?.find((legacyMatch) => match.homeTeam === legacyMatch.homeTeam) ||
        null,
    })),
    raw: legacyPayload,
  };
}
