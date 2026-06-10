import { jsonResponse } from "../../src/lib/matches/server.js";

export default async function searchFootballLeaguesDisabled() {
  return jsonResponse({
    success: false,
    disabled: true,
    leagues: [],
    message: "API-Football league 搜索已停用；当前只使用聚合数据 2026 美加墨世界杯 API。",
  });
}
