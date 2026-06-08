import { jsonResponse } from "../../src/lib/matches/server.js";
import { worldCupRowToClientMatch } from "../../src/lib/matches/providers/worldCupProvider.js";
import { getWorldCupConfig } from "../../src/lib/matches/worldCupConfig.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../../src/lib/supabase.js";

export default async function worldCupMatches(request) {
  const url = new URL(request.url);
  const config = getWorldCupConfig(process.env);
  const limit = clampNumber(url.searchParams.get("limit"), 1, 100, 64);
  const status = url.searchParams.get("status") || "all";

  if (!hasServerSupabaseEnv(process.env)) {
    return jsonResponse({
      success: false,
      sourceStatus: "error",
      sourceLabel: "世界杯缓存",
      updatedAt: null,
      matches: [],
      message: "未配置 Supabase，无法读取世界杯缓存。",
    });
  }

  try {
    const supabase = createServerSupabaseClient(process.env);
    let query = supabase
      .from("world_cup_matches")
      .select("*")
      .eq("league_id", config.leagueId)
      .eq("season", config.season)
      .order("kickoff_time", { ascending: true })
      .limit(limit);

    query = applyStatusFilter(query, status);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const matches = (data || []).map(worldCupRowToClientMatch);
    const latestUpdatedAt =
      (data || [])
        .map((row) => row.updated_at || row.fetched_at)
        .filter(Boolean)
        .sort()
        .at(-1) || null;

    return jsonResponse({
      success: true,
      sourceStatus: "cache",
      sourceLabel: "世界杯赛程缓存",
      updatedAt: latestUpdatedAt,
      matches,
      message: matches.length ? "" : "暂无世界杯缓存赛事，等待同步。",
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      sourceStatus: "error",
      sourceLabel: "世界杯缓存",
      updatedAt: null,
      matches: [],
      message: "世界杯赛事数据暂时不可用，请稍后查看。",
    });
  }
}

function applyStatusFilter(query, status) {
  if (status === "finished") {
    return query.in("status_short", ["FT", "AET", "PEN"]);
  }

  if (status === "live") {
    return query.in("status_short", ["1H", "2H", "HT", "ET", "BT", "P"]);
  }

  if (status === "upcoming") {
    return query.in("status_short", ["NS", "TBD"]);
  }

  return query;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(number)));
}
