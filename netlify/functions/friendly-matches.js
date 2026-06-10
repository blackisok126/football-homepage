import { jsonResponse } from "../../src/lib/matches/server.js";

export default async function friendlyMatchesDisabled() {
  return jsonResponse({
    success: true,
    source: "friendly_matches",
    disabled: true,
    sourceStatus: "cache",
    updatedAt: new Date().toISOString(),
    matches: [],
    message: "国际友谊赛读取已停用；当前网站只展示聚合数据 2026 美加墨世界杯赛程。",
  });
}
