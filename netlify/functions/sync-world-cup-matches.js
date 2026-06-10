import { jsonResponse } from "../../src/lib/matches/server.js";

export default async function syncWorldCupMatchesDisabled() {
  return jsonResponse({
    success: false,
    source: "disabled",
    disabled: true,
    message: "API-Football 世界杯同步已停用，请使用 sync-juhe-world-cup-matches。",
  });
}
