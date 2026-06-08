import { createMockMatchesResponse } from "./mockMatches.js";

const TODAY_MATCHES_API = "/api/matches-today";

export async function getTodayMatchesPayload(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(TODAY_MATCHES_API, {
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
    return createMockMatchesResponse(
      "赛事数据暂时不可用，请稍后查看。当前为演示数据，接入正式数据源后自动更新。",
    );
  }
}

export async function getTodayMatches(fetchImpl = fetch) {
  const payload = await getTodayMatchesPayload(fetchImpl);
  return payload.matches;
}
