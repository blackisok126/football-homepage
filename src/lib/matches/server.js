import { SOURCE_STATUS } from "./types.js";
import { adaptSupabaseRow, formatMatchDate, toSupabaseRow } from "./matchAdapter.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../supabase.js";
import { getApiFootballProviderRecords } from "./providers/apiFootballProvider.js";
import { getLocalChineseProviderRecords } from "./providers/localChineseProvider.js";
import { getMockMatchesPayload, getMockProviderRecords } from "./providers/mockProvider.js";
import { getSportteryProviderRecords } from "./providers/sportteryProvider.js";

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function createErrorPayload(message = "数据暂时不可用") {
  return {
    success: false,
    sourceStatus: SOURCE_STATUS.ERROR,
    updatedAt: null,
    matches: [],
    message,
  };
}

export async function buildMatchesTodayPayload({ env = process.env } = {}) {
  try {
    if (!hasServerSupabaseEnv(env)) {
      return getMockMatchesPayload({
        message: "当前为演示数据，接入正式数据源后自动更新。",
      });
    }

    const supabase = createServerSupabaseClient(env);
    const today = formatMatchDate(new Date());
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("match_date", today)
      .neq("source", "api-football")
      .order("kickoff_time", { ascending: true });

    if (error) {
      throw error;
    }

    if (!data?.length) {
      return getMockMatchesPayload({
        message: "缓存暂无今日赛事，当前展示演示数据。",
      });
    }

    const matches = data.map(adaptSupabaseRow);
    const latestUpdatedAt =
      data
        .map((row) => row.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1) || new Date().toISOString();

    return {
      success: true,
      sourceStatus: SOURCE_STATUS.CACHE,
      updatedAt: latestUpdatedAt,
      matches,
      message: "",
    };
  } catch (error) {
    return createErrorPayload("数据暂时不可用");
  }
}

export async function syncMatches({ env = process.env, fetchImpl = fetch } = {}) {
  const date = formatMatchDate(new Date());
  let providerResult;

  try {
    if (env.MATCH_PROVIDER === "api-football" && env.FOOTBALL_API_KEY) {
      providerResult = await getApiFootballProviderRecords({
        apiKey: env.FOOTBALL_API_KEY,
        baseUrl: env.FOOTBALL_API_BASE_URL,
        date,
        fetchImpl,
      });
    } else {
      providerResult = await getSportteryProviderRecords({ fetchImpl });
    }
  } catch (error) {
    try {
      providerResult = await getLocalChineseProviderRecords();
    } catch {
      providerResult = await getMockProviderRecords({
        message: "中国体育彩票赛事暂时不可用，已回退到演示数据。",
      });
    }
  }

  const matches = providerResult.records.map((record) => record.match);

  if (!hasServerSupabaseEnv(env)) {
    return {
      success: true,
      sourceStatus: providerResult.sourceStatus,
      updatedAt: providerResult.updatedAt,
      matches,
      message: "未配置 Supabase，已跳过缓存写入。",
    };
  }

  try {
    const supabase = createServerSupabaseClient(env);
    const rows = providerResult.records.map((record) =>
      toSupabaseRow(record.match, record.raw),
    );

    const { error } = await supabase.from("matches").upsert(rows, {
      onConflict: "id",
    });

    if (error) {
      throw error;
    }

    if (providerResult.source !== "api-football") {
      await supabase.from("matches").delete().eq("match_date", date).eq("source", "api-football");
    }

    return {
      success: true,
      sourceStatus: providerResult.sourceStatus,
      updatedAt: providerResult.updatedAt,
      matches,
      message:
        providerResult.sourceStatus === SOURCE_STATUS.API
          ? "中国体育彩票赛事已同步并写入缓存。"
          : "已使用中文赛事缓存完成同步。",
    };
  } catch (error) {
    return createErrorPayload("数据同步失败");
  }
}
