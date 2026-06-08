import { createMockMatchesResponse } from "./mockMatches.js";

const TODAY_MATCHES_API = "/api/matches-today";
const WORLD_CUP_MATCHES_API = "/.netlify/functions/world-cup-matches";

export async function getTodayMatchesPayload(fetchImpl = fetch) {
  const worldCupPayload = await fetchMatchesPayload(fetchImpl, WORLD_CUP_MATCHES_API);

  if (
    worldCupPayload?.success &&
    Array.isArray(worldCupPayload.matches) &&
    worldCupPayload.matches.length
  ) {
    return worldCupPayload;
  }

  const fallbackPayload = await fetchMatchesPayload(fetchImpl, TODAY_MATCHES_API);

  if (fallbackPayload?.success && Array.isArray(fallbackPayload.matches)) {
    return {
      ...fallbackPayload,
      message:
        worldCupPayload?.message ||
        fallbackPayload.message ||
        "世界杯赛事缓存暂时不可用，当前展示备用赛事数据。",
    };
  }

  return createMockMatchesResponse(
    "赛事数据暂时不可用，请稍后查看。当前为演示数据，接入正式数据源后自动更新。",
  );
}

async function fetchMatchesPayload(fetchImpl, endpoint) {
  try {
    const response = await fetchImpl(endpoint, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`matches endpoint returned ${response.status}`);
    }

    const payload = await response.json();

    if (!payload?.success || !Array.isArray(payload.matches)) {
      throw new Error(payload?.message || "invalid payload");
    }

    return payload;
  } catch (error) {
    return null;
  }
}

export async function getTodayMatches(fetchImpl = fetch) {
  const payload = await getTodayMatchesPayload(fetchImpl);
  return payload.matches;
}
