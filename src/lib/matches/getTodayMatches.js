const HOMEPAGE_MATCHES_API = "/.netlify/functions/homepage-matches";
const WORLD_CUP_MATCHES_API = "/.netlify/functions/world-cup-matches";

export async function getTodayMatchesPayload(fetchImpl = fetch) {
  const homepagePayload = await fetchMatchesPayload(fetchImpl, HOMEPAGE_MATCHES_API);

  if (homepagePayload?.success && Array.isArray(homepagePayload.matches)) {
    return homepagePayload;
  }

  const worldCupPayload = await fetchMatchesPayload(fetchImpl, WORLD_CUP_MATCHES_API);

  if (
    worldCupPayload?.success &&
    Array.isArray(worldCupPayload.matches) &&
    worldCupPayload.matches.length
  ) {
    return worldCupPayload;
  }

  return createEmptyWorldCupPayload(
    worldCupPayload?.message || "2026 美加墨世界杯赛程等待更新。",
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

function createEmptyWorldCupPayload(message) {
  return {
    success: true,
    sourceStatus: "cache",
    sourceLabel: "聚合数据世界杯缓存",
    displaySource: "juhe_worldcup",
    displayTitle: "2026 美加墨世界杯赛程",
    displayNotice: message,
    updatedAt: new Date().toISOString(),
    matches: [],
    message,
  };
}
