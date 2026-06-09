import { jsonResponse } from "../../src/lib/matches/server.js";
import {
  friendlyRowToClientMatch,
  getFriendliesDateRange,
} from "../../src/lib/matches/providers/friendliesProvider.js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "../../src/lib/supabase.js";

export default async function friendlyMatches(request) {
  const url = new URL(request.url);
  const range = getFriendliesDateRange(process.env);
  const limit = clampNumber(url.searchParams.get("limit"), 1, 50, 12);

  if (!hasServerSupabaseEnv(process.env)) {
    return jsonResponse({
      success: false,
      source: "friendly_matches",
      sourceStatus: "error",
      updatedAt: null,
      matches: [],
    });
  }

  try {
    const supabase = createServerSupabaseClient(process.env);
    const { data, error } = await supabase
      .from("friendly_matches")
      .select("*")
      .gte("match_date", range.from)
      .lte("match_date", range.to)
      .order("kickoff_time", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const rows = (data || []).length
      ? data
      : await readUpcomingFriendlyRows(supabase, limit);
    const matches = rows.map(friendlyRowToClientMatch);
    const updatedAt =
      rows
        .map((row) => row.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1) || null;

    return jsonResponse({
      success: true,
      source: "friendly_matches",
      sourceStatus: "cache",
      updatedAt,
      matches,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      source: "friendly_matches",
      sourceStatus: "error",
      updatedAt: null,
      matches: [],
    });
  }
}

async function readUpcomingFriendlyRows(supabase, limit) {
  const { data, error } = await supabase
    .from("friendly_matches")
    .select("*")
    .gte("kickoff_time", new Date().toISOString())
    .order("kickoff_time", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(number)));
}
