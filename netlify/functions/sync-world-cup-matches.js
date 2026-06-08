import { schedule } from "@netlify/functions";
import {
  fetchWorldCupMatches,
  worldCupMatchToSupabaseRow,
} from "../../src/lib/matches/providers/worldCupProvider.js";
import { getWorldCupConfig } from "../../src/lib/matches/worldCupConfig.js";
import { jsonResponse } from "../../src/lib/matches/server.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../../src/lib/supabase.js";

async function syncWorldCupMatches() {
  const config = getWorldCupConfig(process.env);
  const fetchedAt = new Date().toISOString();

  if (!hasServerSupabaseEnv(process.env)) {
    return jsonResponse({
      success: false,
      fetched_count: 0,
      upserted_count: 0,
      season: config.season,
      league_id: config.leagueId,
      fetched_at: fetchedAt,
      error: "未配置 Supabase 环境变量",
    });
  }

  try {
    const providerResult = await fetchWorldCupMatches({
      env: process.env,
      baseUrl: process.env.FOOTBALL_API_BASE_URL,
    });
    const rows = providerResult.matches.map(worldCupMatchToSupabaseRow);
    const supabase = createServerSupabaseClient(process.env);
    let upsertedCount = 0;

    if (rows.length) {
      const { error } = await supabase.from("world_cup_matches").upsert(rows, {
        onConflict: "match_key",
      });

      if (error) {
        throw error;
      }

      upsertedCount = rows.length;
    }

    return jsonResponse({
      success: true,
      fetched_count: providerResult.matches.length,
      upserted_count: upsertedCount,
      season: config.season,
      league_id: config.leagueId,
      fetched_at: fetchedAt,
      error: null,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      fetched_count: 0,
      upserted_count: 0,
      season: config.season,
      league_id: config.leagueId,
      fetched_at: fetchedAt,
      error: error.message || "世界杯赛事同步失败",
    });
  }
}

export default schedule("0 */6 * * *", syncWorldCupMatches);
