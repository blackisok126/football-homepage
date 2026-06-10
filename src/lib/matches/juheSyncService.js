import {
  fetchJuheWorldCupMatches,
  hasJuheConfig,
  juheMatchToSupabaseRow,
} from "./providers/juheProvider.js";
import { jsonResponse } from "./server.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../supabase.js";

const DEFAULT_SYNC_COOLDOWN_MINUTES = 40;

export async function syncJuheWorldCupMatches(request, env = process.env) {
  const fetchedAt = new Date().toISOString();
  const forceSync = new URL(request.url).searchParams.get("force") === "1";
  const cooldownMinutes = readCooldownMinutes(env.JUHE_SYNC_COOLDOWN_MINUTES);

  if (!hasServerSupabaseEnv(env)) {
    return jsonResponse({
      success: false,
      source: "juhe_worldcup",
      fetched_count: 0,
      upserted_count: 0,
      fetched_at: fetchedAt,
      error: "未配置 Supabase 环境变量",
    });
  }

  if (!hasJuheConfig(env)) {
    return jsonResponse({
      success: false,
      source: "juhe_worldcup",
      reason: "missing_config",
      fetched_count: 0,
      upserted_count: 0,
      fetched_at: fetchedAt,
      error: "未配置 JUHE_API_KEY 或 JUHE_WORLD_CUP_API_URL",
    });
  }

  try {
    const supabase = createServerSupabaseClient(env);
    const lastSuccessfulSync = await readLastSuccessfulSync(supabase);

    if (!forceSync && isWithinCooldown(lastSuccessfulSync, cooldownMinutes)) {
      return jsonResponse({
        success: true,
        source: "juhe_worldcup",
        skipped: true,
        reason: "cooldown",
        fetched_count: 0,
        upserted_count: 0,
        fetched_at: fetchedAt,
        last_synced_at: lastSuccessfulSync,
        message: `距离上次同步不足 ${cooldownMinutes} 分钟，已跳过以节省聚合数据请求次数。`,
        error: null,
      });
    }

    const providerResult = await fetchJuheWorldCupMatches({ env });
    const rows = providerResult.matches.map(juheMatchToSupabaseRow);
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
      source: "juhe_worldcup",
      fetched_count: providerResult.matches.length,
      upserted_count: upsertedCount,
      fetched_at: fetchedAt,
      message: providerResult.matches.length
        ? "聚合数据世界杯赛程已同步"
        : "聚合数据暂未返回世界杯赛程",
      error: null,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      source: "juhe_worldcup",
      fetched_count: 0,
      upserted_count: 0,
      fetched_at: fetchedAt,
      error: error.message || "聚合数据世界杯赛事同步失败",
    });
  }
}

async function readLastSuccessfulSync(supabase) {
  const { data, error } = await supabase
    .from("world_cup_matches")
    .select("last_synced_at,updated_at,fetched_at")
    .eq("source", "juhe_worldcup")
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    return null;
  }

  const row = data?.[0];
  return row?.last_synced_at || row?.updated_at || row?.fetched_at || null;
}

function isWithinCooldown(value, cooldownMinutes) {
  const lastSyncTime = Date.parse(value || "");

  if (Number.isNaN(lastSyncTime)) {
    return false;
  }

  return Date.now() - lastSyncTime < cooldownMinutes * 60 * 1000;
}

function readCooldownMinutes(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : DEFAULT_SYNC_COOLDOWN_MINUTES;
}
