import { schedule } from "@netlify/functions";
import {
  fetchChinaLotteryMatches,
  lotteryMatchToSupabaseRow,
} from "../../src/lib/matches/providers/chinaLotteryProvider.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../../src/lib/supabase.js";
import { jsonResponse } from "../../src/lib/matches/server.js";

async function syncLotteryMatches() {
  const fetchedAt = new Date().toISOString();
  const providerResult = await fetchChinaLotteryMatches();

  if (!hasServerSupabaseEnv(process.env)) {
    return jsonResponse({
      success: providerResult.success,
      fetched: providerResult.matches.length,
      upserted: 0,
      fetched_at: fetchedAt,
      errors: providerResult.errors,
      message: "未配置 Supabase，已跳过缓存写入。",
    });
  }

  const supabase = createServerSupabaseClient(process.env);
  const rows = providerResult.matches.map(lotteryMatchToSupabaseRow);
  let upserted = 0;
  const errors = [...providerResult.errors];

  if (rows.length) {
    const { error } = await supabase.from("lottery_matches").upsert(rows, {
      onConflict: "match_key",
    });

    if (error) {
      errors.push(error.message);
    } else {
      upserted = rows.length;
    }
  }

  return jsonResponse({
    success: providerResult.success && errors.length === providerResult.errors.length,
    fetched: providerResult.matches.length,
    upserted,
    fetched_at: fetchedAt,
    errors,
    message: rows.length
      ? "中国体育彩票赛事已同步。"
      : "未抓取到新的中国体育彩票赛事，前端将继续读取最近缓存。",
  });
}

export default schedule("0 0-15 * * *", syncLotteryMatches);
