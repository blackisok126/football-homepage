import { jsonResponse } from "../../src/lib/matches/server.js";
import { juheRowToClientMatch } from "../../src/lib/matches/providers/juheProvider.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../../src/lib/supabase.js";

export default async function worldCupMatches(request) {
  const url = new URL(request.url);
  const limit = clampNumber(url.searchParams.get("limit"), 1, 100, 64);
  const status = url.searchParams.get("status") || "all";

  if (!hasServerSupabaseEnv(process.env)) {
    return jsonResponse({
      success: false,
      sourceStatus: "error",
      sourceLabel: "聚合数据世界杯缓存",
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
      .eq("source", "juhe_worldcup")
      .order("priority", { ascending: false })
      .order("match_time", { ascending: true })
      .limit(limit);

    query = applyStatusFilter(query, status);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const matches = (data || []).map(juheRowToClientMatch);
    const latestUpdatedAt =
      (data || [])
        .map((row) => row.updated_at || row.last_synced_at || row.fetched_at)
        .filter(Boolean)
        .sort()
        .at(-1) || null;

    return jsonResponse({
      success: true,
      sourceStatus: "cache",
      sourceLabel: "聚合数据世界杯缓存",
      updatedAt: latestUpdatedAt,
      matches,
      message: matches.length ? "" : "2026 美加墨世界杯赛程等待更新。",
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      sourceStatus: "error",
      sourceLabel: "聚合数据世界杯缓存",
      updatedAt: null,
      matches: [],
      message: "世界杯赛事数据暂时不可用，请稍后查看。",
    });
  }
}

function applyStatusFilter(query, status) {
  if (status === "finished") {
    return query.in("status", ["finished", "ft", "FT", "已结束", "完场"]);
  }

  if (status === "live") {
    return query.in("status", ["live", "1h", "2h", "HT", "进行中", "比赛中"]);
  }

  if (status === "upcoming") {
    return query.in("status", ["not_started", "ns", "NS", "scheduled", "未开始", "未开赛"]);
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
