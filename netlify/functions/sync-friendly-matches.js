import { schedule } from "@netlify/functions";
import {
  fetchFriendlyMatches,
  friendlyMatchToSupabaseRow,
  getFriendliesConfig,
  hasFriendliesProviderConfig,
} from "../../src/lib/matches/providers/friendliesProvider.js";
import { jsonResponse } from "../../src/lib/matches/server.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../../src/lib/supabase.js";

async function syncFriendlyMatches() {
  const config = getFriendliesConfig(process.env);
  const fetchedAt = new Date().toISOString();

  if (!hasFriendliesProviderConfig(process.env) || !hasServerSupabaseEnv(process.env)) {
    return jsonResponse({
      success: false,
      reason: "missing_config",
      synced: 0,
      league_id: config.leagueId || null,
      season: config.season,
      fetched_at: fetchedAt,
    });
  }

  try {
    const providerResult = await fetchFriendlyMatches({
      env: process.env,
      baseUrl: process.env.FOOTBALL_API_BASE_URL,
    });

    const rows = providerResult.records.map((record) =>
      friendlyMatchToSupabaseRow(record.match, record.raw),
    );

    if (!rows.length) {
      return jsonResponse({
        success: true,
        synced: 0,
        message: "No friendly matches found in current date range",
        fetched_at: fetchedAt,
      });
    }

    const supabase = createServerSupabaseClient(process.env);
    const { error } = await supabase.from("friendly_matches").upsert(rows, {
      onConflict: "id",
    });

    if (error) {
      throw error;
    }

    return jsonResponse({
      success: true,
      synced: rows.length,
      message: "Friendly matches synced",
      fetched_at: fetchedAt,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      reason: "sync_failed",
      synced: 0,
      message: error.message || "Friendly matches sync failed",
      fetched_at: fetchedAt,
    });
  }
}

export default schedule("0 */6 * * *", syncFriendlyMatches);
