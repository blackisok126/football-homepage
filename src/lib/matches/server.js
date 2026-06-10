import { SOURCE_STATUS } from "./types.js";

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function createErrorPayload(message = "世界杯赛事数据暂时不可用") {
  return {
    success: false,
    sourceStatus: SOURCE_STATUS.ERROR,
    updatedAt: null,
    matches: [],
    message,
  };
}

export function createEmptyWorldCupPayload(message = "2026 美加墨世界杯赛程等待更新。") {
  return {
    success: true,
    sourceStatus: SOURCE_STATUS.CACHE,
    sourceLabel: "聚合数据世界杯缓存",
    displaySource: "juhe_worldcup",
    displayTitle: "2026 美加墨世界杯赛程",
    displayNotice: message,
    updatedAt: new Date().toISOString(),
    matches: [],
    message,
  };
}

export async function buildMatchesTodayPayload() {
  return createEmptyWorldCupPayload();
}

export async function syncMatches() {
  return {
    success: false,
    disabled: true,
    sourceStatus: SOURCE_STATUS.ERROR,
    updatedAt: new Date().toISOString(),
    matches: [],
    message: "通用赛事同步已停用；当前只使用聚合数据 2026 美加墨世界杯 API。",
  };
}
