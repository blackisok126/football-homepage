import { jsonResponse } from "../../src/lib/matches/server.js";
import { juheRowToClientMatch } from "../../src/lib/matches/providers/juheProvider.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../../src/lib/supabase.js";

export default async function homepageMatches() {
  if (!hasServerSupabaseEnv(process.env)) {
    return jsonResponse(createEmptyWorldCupPayload("未配置 Supabase，暂无世界杯赛事数据。"));
  }

  try {
    const supabase = createServerSupabaseClient(process.env);
    const { data, error } = await supabase
      .from("world_cup_matches")
      .select("*")
      .eq("source", "juhe_worldcup")
      .order("priority", { ascending: false })
      .order("match_time", { ascending: true })
      .limit(100);

    if (error) {
      throw error;
    }

    const sortedRows = sortWorldCupRows(data || []);
    const matches = sortedRows.map(juheRowToClientMatch);
    const updatedAt = latestUpdatedAt(sortedRows, "updated_at", "last_synced_at", "fetched_at");

    if (!matches.length) {
      return jsonResponse(createEmptyWorldCupPayload("2026 美加墨世界杯赛程等待更新。"));
    }

    return jsonResponse({
      success: true,
      displaySource: "juhe_worldcup",
      displayTitle: "2026 美加墨世界杯赛程",
      displayNotice: null,
      sourceStatus: "cache",
      sourceLabel: "聚合数据世界杯缓存",
      updatedAt,
      matches,
      meta: {
        worldCupCount: matches.length,
        mockCount: 0,
      },
    });
  } catch (error) {
    return jsonResponse(createEmptyWorldCupPayload("世界杯赛事数据暂时不可用，请稍后查看。"));
  }
}

function createEmptyWorldCupPayload(message) {
  const now = new Date().toISOString();

  return {
    success: true,
    displaySource: "juhe_worldcup",
    displayTitle: "2026 美加墨世界杯赛程",
    displayNotice: message,
    sourceStatus: "cache",
    sourceLabel: "聚合数据世界杯缓存",
    updatedAt: now,
    matches: [],
    message,
    meta: {
      worldCupCount: 0,
      mockCount: 0,
    },
  };
}

function sortWorldCupRows(rows) {
  return [...rows].sort((a, b) => {
    const statusDelta = statusRank(a) - statusRank(b);

    if (statusDelta) {
      return statusDelta;
    }

    const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);

    if (priorityDelta) {
      return priorityDelta;
    }

    return Date.parse(a.match_time || a.kickoff_time || "") - Date.parse(b.match_time || b.kickoff_time || "");
  });
}

function statusRank(row = {}) {
  const status = String(row.status || row.status_short || "").toLowerCase();

  if (["not_started", "ns", "tbd", "scheduled", "timed", "未开始", "未开赛"].includes(status)) {
    return 0;
  }

  if (["live", "1h", "2h", "ht", "进行中", "比赛中"].includes(status)) {
    return 1;
  }

  if (["postponed", "pst", "延期"].includes(status)) {
    return 2;
  }

  if (["finished", "ft", "aet", "pen", "已结束", "完场"].includes(status)) {
    return 3;
  }

  return 2;
}

function latestUpdatedAt(rows = [], ...keys) {
  return (
    rows
      .flatMap((row) => keys.map((key) => row?.[key]))
      .filter(Boolean)
      .sort()
      .at(-1) || new Date().toISOString()
  );
}
