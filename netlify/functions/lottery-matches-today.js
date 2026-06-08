import { createServerSupabaseClient, hasServerSupabaseEnv } from "../../src/lib/supabase.js";
import { jsonResponse } from "../../src/lib/matches/server.js";
import { lotteryRowToClientMatch } from "../../src/lib/matches/providers/chinaLotteryProvider.js";

export default async function lotteryMatchesToday(request) {
  const url = new URL(request.url);
  const limit = clampNumber(url.searchParams.get("limit"), 1, 100, 50);
  const status = url.searchParams.get("status") || "all";
  const date = url.searchParams.get("date") || formatChinaDate(new Date());
  const start = toChinaDateStart(date);
  const end = addDaysIso(start, url.searchParams.has("date") ? 1 : 4);

  if (!hasServerSupabaseEnv(process.env)) {
    return jsonResponse({
      success: false,
      sourceStatus: "error",
      sourceLabel: "中国体育彩票赛程",
      updatedAt: null,
      matches: [],
      message: "未配置 Supabase，无法读取体彩缓存。",
    });
  }

  try {
    const supabase = createServerSupabaseClient(process.env);
    let query = supabase
      .from("lottery_matches")
      .select("*")
      .gte("kickoff_time", start)
      .lt("kickoff_time", end)
      .order("kickoff_time", { ascending: true })
      .limit(limit);

    if (status !== "all") {
      query = applyStatusFilter(query, status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const matches = (data || []).map(lotteryRowToClientMatch);
    const latestUpdatedAt =
      (data || [])
        .map((row) => row.updated_at || row.fetched_at)
        .filter(Boolean)
        .sort()
        .at(-1) || null;

    return jsonResponse({
      success: true,
      sourceStatus: "cache",
      sourceLabel: "中国体育彩票赛程 / 本地缓存",
      updatedAt: latestUpdatedAt,
      matches,
      message: matches.length ? "" : "暂无中国体育彩票缓存赛事。",
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      sourceStatus: "error",
      sourceLabel: "中国体育彩票赛程",
      updatedAt: null,
      matches: [],
      message: "中国体育彩票赛事数据暂时不可用。",
    });
  }
}

function applyStatusFilter(query, status) {
  if (status === "finished") {
    return query.eq("status", "finished");
  }

  if (status === "live") {
    return query.eq("status", "live");
  }

  if (status === "upcoming") {
    return query.eq("status", "not_started");
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

function formatChinaDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toChinaDateStart(date) {
  return new Date(`${date}T00:00:00+08:00`).toISOString();
}

function addDaysIso(isoDate, days) {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}
