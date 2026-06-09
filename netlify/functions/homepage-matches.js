import { jsonResponse } from "../../src/lib/matches/server.js";
import { createMockMatchesResponse } from "../../src/lib/matches/mockMatches.js";
import { worldCupRowToClientMatch } from "../../src/lib/matches/providers/worldCupProvider.js";
import {
  friendlyRowToClientMatch,
  getFriendliesDateRange,
} from "../../src/lib/matches/providers/friendliesProvider.js";
import { getWorldCupConfig } from "../../src/lib/matches/worldCupConfig.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../../src/lib/supabase.js";

const WORLD_CUP_HOME_WINDOW_DAYS = 30;

export default async function homepageMatches() {
  if (!hasServerSupabaseEnv(process.env)) {
    return jsonResponse(createMockHomepagePayload("未配置 Supabase，当前展示演示数据。"));
  }

  try {
    const supabase = createServerSupabaseClient(process.env);
    const [worldCupResult, friendlyResult] = await Promise.all([
      readWorldCupMatches(supabase).catch(() => ({ matches: [], updatedAt: null })),
      readFriendlyMatches(supabase).catch(() => ({ matches: [], updatedAt: null })),
    ]);

    const worldCupMatches = worldCupResult.matches;
    const friendlyMatches = friendlyResult.matches;
    const hasWorldCupMatches =
      worldCupMatches.length > 0 && worldCupMatches.some(isWithinFutureDays);

    if (hasWorldCupMatches) {
      return jsonResponse({
        success: true,
        displaySource: "world_cup",
        displayTitle: "世界杯赛程",
        displayNotice: null,
        sourceStatus: "cache",
        sourceLabel: "世界杯赛程缓存",
        updatedAt: worldCupResult.updatedAt,
        matches: worldCupMatches,
        meta: {
          worldCupCount: worldCupMatches.length,
          friendlyCount: friendlyMatches.length,
          mockCount: 0,
        },
      });
    }

    if (friendlyMatches.length) {
      return jsonResponse({
        success: true,
        displaySource: "friendly",
        displayTitle: "近期国际友谊赛",
        displayNotice: "世界杯正赛尚未开始，当前先展示近期国际友谊赛。",
        sourceStatus: "cache",
        sourceLabel: "国际友谊赛缓存",
        updatedAt: friendlyResult.updatedAt,
        matches: friendlyMatches,
        meta: {
          worldCupCount: worldCupMatches.length,
          friendlyCount: friendlyMatches.length,
          mockCount: 0,
        },
      });
    }

    return jsonResponse(createMockHomepagePayload("当前暂无可用赛程，先展示演示数据。"));
  } catch (error) {
    return jsonResponse(createMockHomepagePayload("赛事数据暂时不可用，请稍后查看。当前为演示数据。"));
  }
}

async function readWorldCupMatches(supabase) {
  const config = getWorldCupConfig(process.env);
  const { data, error } = await supabase
    .from("world_cup_matches")
    .select("*")
    .eq("league_id", config.leagueId)
    .eq("season", config.season)
    .order("kickoff_time", { ascending: true })
    .limit(64);

  if (error) {
    throw error;
  }

  return {
    matches: (data || []).map(worldCupRowToClientMatch),
    updatedAt: latestUpdatedAt(data, "updated_at", "fetched_at"),
  };
}

async function readFriendlyMatches(supabase) {
  const range = getFriendliesDateRange(process.env);
  const { data, error } = await supabase
    .from("friendly_matches")
    .select("*")
    .gte("match_date", range.from)
    .lte("match_date", range.to)
    .order("kickoff_time", { ascending: true })
    .limit(12);

  if (error) {
    throw error;
  }

  const rows = (data || []).length ? data : await readUpcomingFriendlyRows(supabase);

  return {
    matches: rows.map(friendlyRowToClientMatch),
    updatedAt: latestUpdatedAt(rows, "updated_at"),
  };
}

async function readUpcomingFriendlyRows(supabase) {
  const { data, error } = await supabase
    .from("friendly_matches")
    .select("*")
    .gte("kickoff_time", new Date().toISOString())
    .order("kickoff_time", { ascending: true })
    .limit(12);

  if (error) {
    throw error;
  }

  return data || [];
}

function isWithinFutureDays(match) {
  const kickoffTime = Date.parse(match.kickoffTime || "");

  if (Number.isNaN(kickoffTime)) {
    return false;
  }

  const now = Date.now();
  const max = now + WORLD_CUP_HOME_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return kickoffTime >= now && kickoffTime <= max;
}

function createMockHomepagePayload(message) {
  const mockPayload = createMockMatchesResponse(message);

  return {
    ...mockPayload,
    displaySource: "mock",
    displayTitle: "今日赛事",
    displayNotice: message,
    sourceLabel: "演示数据",
    meta: {
      worldCupCount: 0,
      friendlyCount: 0,
      mockCount: mockPayload.matches.length,
    },
  };
}

function latestUpdatedAt(rows = [], ...keys) {
  return (
    rows
      .flatMap((row) => keys.map((key) => row?.[key]))
      .filter(Boolean)
      .sort()
      .at(-1) || null
  );
}
