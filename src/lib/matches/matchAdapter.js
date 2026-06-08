import { MATCH_STATUS, SOURCE_STATUS } from "./types.js";

const BEIJING_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatMatchDate(dateInput) {
  const date = new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return BEIJING_DATE_FORMATTER.format(date);
}

export function createMatchId(...parts) {
  return parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeMatchStatus(status) {
  const value = String(status || "").trim().toLowerCase();

  if (!value) {
    return MATCH_STATUS.UNKNOWN;
  }

  if (
    [
      "ft",
      "aet",
      "pen",
      "finished",
      "match finished",
      "已结束",
      "完场",
      "结束",
    ].includes(value) ||
    /完场|已结束|比赛结束|结束/.test(value)
  ) {
    return MATCH_STATUS.FINISHED;
  }

  if (
    [
      "1h",
      "2h",
      "ht",
      "et",
      "bt",
      "live",
      "in play",
      "进行中",
    ].includes(value) ||
    /直播|进行|上半场|下半场|中场|加时|点球/.test(value)
  ) {
    return MATCH_STATUS.LIVE;
  }

  if (
    [
      "pst",
      "postponed",
      "延期",
      "推迟",
      "cancelled",
      "canc",
    ].includes(value) ||
    /延期|推迟|取消/.test(value)
  ) {
    return MATCH_STATUS.POSTPONED;
  }

  if (
    [
      "ns",
      "tbd",
      "time to be defined",
      "not started",
      "未开始",
      "scheduled",
    ].includes(value) ||
    /未开始|待定|即将/.test(value)
  ) {
    return MATCH_STATUS.NOT_STARTED;
  }

  return MATCH_STATUS.UNKNOWN;
}

export function adaptLegacyMatch(legacyMatch = {}, meta = {}) {
  const kickoffTime = legacyMatch.kickoffTime || new Date().toISOString();
  const updatedAt = meta.updatedAt || new Date().toISOString();

  return {
    id:
      legacyMatch.id ||
      createMatchId(
        legacyMatch.matchNo,
        kickoffTime,
        legacyMatch.homeTeam,
        legacyMatch.awayTeam,
      ),
    matchDate: formatMatchDate(kickoffTime),
    kickoffTime,
    league: legacyMatch.competition || "未命名赛事",
    homeTeam: legacyMatch.homeTeam || "主队待定",
    awayTeam: legacyMatch.awayTeam || "客队待定",
    status: normalizeMatchStatus(legacyMatch.status),
    homeScore: legacyMatch.homeScore ?? null,
    awayScore: legacyMatch.awayScore ?? null,
    round: legacyMatch.round ?? legacyMatch.matchNo ?? null,
    source: meta.source || legacyMatch.sourceUrl || "legacy-data",
    sourceStatus: meta.sourceStatus || SOURCE_STATUS.MOCK,
    updatedAt,
  };
}

export function adaptLegacyPayload(payload = {}, meta = {}) {
  const matches = Array.isArray(payload.matches) ? payload.matches : [];

  return matches.map((legacyMatch) =>
    adaptLegacyMatch(legacyMatch, {
      source: meta.source || payload.source,
      sourceStatus: meta.sourceStatus,
      updatedAt: meta.updatedAt || payload.updatedAt,
    }),
  );
}

export function adaptApiFootballMatch(rawMatch = {}, meta = {}) {
  const fixture = rawMatch.fixture || {};
  const league = rawMatch.league || {};
  const teams = rawMatch.teams || {};
  const goals = rawMatch.goals || {};
  const kickoffTime = fixture.date || new Date().toISOString();
  const updatedAt = meta.updatedAt || new Date().toISOString();

  return {
    id:
      String(fixture.id || "") ||
      createMatchId(kickoffTime, teams.home?.name, teams.away?.name),
    matchDate: formatMatchDate(kickoffTime),
    kickoffTime,
    league: league.name || "未命名赛事",
    homeTeam: teams.home?.name || "主队待定",
    awayTeam: teams.away?.name || "客队待定",
    status: normalizeMatchStatus(fixture.status?.short || fixture.status?.long),
    homeScore: toNullableNumber(goals.home),
    awayScore: toNullableNumber(goals.away),
    round: league.round || null,
    source: meta.source || "api-football",
    sourceStatus: meta.sourceStatus || SOURCE_STATUS.API,
    updatedAt,
  };
}

export function adaptSupabaseRow(row = {}) {
  return {
    id: row.id,
    matchDate: row.match_date,
    kickoffTime: row.kickoff_time,
    league: row.league,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    status: normalizeMatchStatus(row.status),
    homeScore: toNullableNumber(row.home_score),
    awayScore: toNullableNumber(row.away_score),
    round: row.round ?? null,
    source: row.source || "supabase-cache",
    sourceStatus: row.source_status || SOURCE_STATUS.CACHE,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function toSupabaseRow(match, raw = null) {
  return {
    id: match.id,
    match_date: match.matchDate,
    kickoff_time: match.kickoffTime,
    league: match.league,
    home_team: match.homeTeam,
    away_team: match.awayTeam,
    status: match.status,
    home_score: toNullableNumber(match.homeScore),
    away_score: toNullableNumber(match.awayScore),
    round: match.round ?? null,
    source: match.source,
    source_status: match.sourceStatus,
    raw,
    updated_at: match.updatedAt,
  };
}

export function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
