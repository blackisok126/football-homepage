import { jsonResponse } from "../../src/lib/matches/server.js";

export default async function syncFriendlyMatchesDisabled() {
  return jsonResponse({
    success: false,
    source: "disabled",
    disabled: true,
    message: "国际友谊赛同步已停用；当前网站只展示聚合数据 2026 美加墨世界杯赛程。",
  });
}
