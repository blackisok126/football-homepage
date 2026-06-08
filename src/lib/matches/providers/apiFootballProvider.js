import { SOURCE_STATUS } from "../types.js";
import { adaptApiFootballMatch } from "../matchAdapter.js";

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";

export async function getApiFootballProviderRecords({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  date,
  fetchImpl = fetch,
}) {
  if (!apiKey) {
    throw new Error("FOOTBALL_API_KEY is missing");
  }

  const normalizedBaseUrl = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  const requestUrl = new URL(`${normalizedBaseUrl}/fixtures`);
  requestUrl.searchParams.set("date", date);
  requestUrl.searchParams.set("timezone", "Asia/Shanghai");

  const response = await fetchImpl(requestUrl, {
    headers: {
      Accept: "application/json",
      "x-apisports-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status}`);
  }

  const payload = await response.json();
  const rawMatches = Array.isArray(payload.response) ? payload.response : [];
  const updatedAt = new Date().toISOString();

  return {
    source: "api-football",
    sourceStatus: SOURCE_STATUS.API,
    updatedAt,
    records: rawMatches.map((rawMatch) => ({
      match: adaptApiFootballMatch(rawMatch, {
        source: "api-football",
        sourceStatus: SOURCE_STATUS.API,
        updatedAt,
      }),
      raw: rawMatch,
    })),
    raw: payload,
  };
}
