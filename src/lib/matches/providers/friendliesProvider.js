import aliases from "../../../../data/football-cn-aliases.json" with { type: "json" };
import { SOURCE_STATUS } from "../types.js";

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";
const DEFAULT_SEASON = 2026;
const DEFAULT_LOOKBACK_DAYS = 3;
const DEFAULT_LOOKAHEAD_DAYS = 21;
const TIME_ZONE = "Asia/Shanghai";

export function getFriendliesConfig(env = process.env) {
  const leagueId = String(env.FRIENDLIES_LEAGUE_ID || "").trim();

  return {
    leagueId,
    season: readNumber(env.FRIENDLIES_SEASON, DEFAULT_SEASON),
    lookbackDays: readNumber(env.FRIENDLIES_LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS),
    lookaheadDays: readNumber(env.FRIENDLIES_LOOKAHEAD_DAYS, DEFAULT_LOOKAHEAD_DAYS),
  };
}

export function hasFriendliesProviderConfig(env = process.env) {
  return Boolean(
    String(env.FRIENDLIES_LEAGUE_ID || "").trim() &&
      String(env.API_FOOTBALL_KEY || env.FOOTBALL_API_KEY || "").trim(),
  );
}

export function getFriendliesDateRange(env = process.env, now = new Date()) {
  const config = getFriendliesConfig(env);
  const today = getTimeZoneDateParts(now);

  return {
    from: addDays(today, -config.lookbackDays),
    to: addDays(today, config.lookaheadDays),
  };
}

export async function fetchFriendlyMatches({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const key = apiKey || env.API_FOOTBALL_KEY || env.FOOTBALL_API_KEY;
  const config = getFriendliesConfig(env);

  if (!config.leagueId || !key) {
    return {
      success: false,
      reason: "missing_config",
      source: "api_football_friendlies",
      sourceStatus: SOURCE_STATUS.ERROR,
      updatedAt: new Date().toISOString(),
      matches: [],
      records: [],
    };
  }

  const range = getFriendliesDateRange(env);
  const normalizedBaseUrl = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  const requestUrl = new URL(`${normalizedBaseUrl}/fixtures`);
  requestUrl.searchParams.set("league", config.leagueId);
  requestUrl.searchParams.set("season", String(config.season));
  requestUrl.searchParams.set("from", range.from);
  requestUrl.searchParams.set("to", range.to);
  requestUrl.searchParams.set("timezone", TIME_ZONE);

  const response = await fetchImpl(requestUrl, {
    headers: {
      Accept: "application/json",
      "x-apisports-key": key,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football friendlies request failed: ${response.status}`);
  }

  const payload = await response.json();
  const fixtures = Array.isArray(payload.response) ? payload.response : [];
  const updatedAt = new Date().toISOString();
  const matches = fixtures.map((fixture) => normalizeFriendlyFixture(fixture, updatedAt));

  return {
    success: true,
    source: "api_football_friendlies",
    sourceStatus: SOURCE_STATUS.API,
    updatedAt,
    matches,
    records: matches.map((match, index) => ({
      match,
      raw: fixtures[index],
    })),
    raw: payload,
  };
}

export function friendlyMatchToSupabaseRow(match, raw = match.raw) {
  return {
    id: match.id,
    match_date: match.matchDate,
    kickoff_time: match.kickoffTime,
    league: match.leagueRaw,
    league_zh: match.league,
    home_team: match.homeTeamRaw,
    home_team_zh: match.homeTeam,
    away_team: match.awayTeamRaw,
    away_team_zh: match.awayTeam,
    status: match.status,
    home_score: match.homeScore,
    away_score: match.awayScore,
    round: match.round,
    source: match.source,
    source_status: match.sourceStatus,
    raw,
    updated_at: match.updatedAt,
  };
}

export function friendlyRowToClientMatch(row = {}) {
  return {
    id: row.id || "",
    matchDate: row.match_date || formatChinaDate(row.kickoff_time),
    kickoffTime: row.kickoff_time,
    league: row.league_zh || translateLeague(row.league) || row.league || "国际友谊赛",
    displayLeague: "国际友谊赛",
    homeTeam: row.home_team_zh || translateTeam(row.home_team) || row.home_team || "主队待定",
    awayTeam: row.away_team_zh || translateTeam(row.away_team) || row.away_team || "客队待定",
    status: row.status || "unknown",
    homeScore: toNullableNumber(row.home_score),
    awayScore: toNullableNumber(row.away_score),
    round: row.round || null,
    source: row.source || "api_football_friendlies",
    sourceStatus: SOURCE_STATUS.CACHE,
    updatedAt: row.updated_at || new Date().toISOString(),
    competitionType: "friendly",
    isFallbackCompetition: true,
    tag: "友谊赛",
  };
}

function normalizeFriendlyFixture(raw = {}, updatedAt) {
  const fixture = raw.fixture || {};
  const league = raw.league || {};
  const teams = raw.teams || {};
  const goals = raw.goals || {};
  const fixtureId = fixture.id || `${league.id || "friendly"}:${fixture.date || updatedAt}`;
  const leagueName = league.name || "Friendlies";
  const homeName = teams.home?.name || "";
  const awayName = teams.away?.name || "";

  return {
    id: `api_football:friendly:${league.season || DEFAULT_SEASON}:${fixtureId}`,
    matchDate: formatChinaDate(fixture.date),
    kickoffTime: fixture.date || updatedAt,
    league: translateLeague(leagueName) || "国际友谊赛",
    displayLeague: "国际友谊赛",
    leagueRaw: leagueName,
    homeTeam: translateTeam(homeName) || homeName || "主队待定",
    homeTeamRaw: homeName,
    awayTeam: translateTeam(awayName) || awayName || "客队待定",
    awayTeamRaw: awayName,
    status: normalizeStatusShort(fixture.status?.short || fixture.status?.long || ""),
    homeScore: toNullableNumber(goals.home),
    awayScore: toNullableNumber(goals.away),
    round: league.round || null,
    source: "api_football_friendlies",
    sourceStatus: SOURCE_STATUS.API,
    updatedAt,
    competitionType: "friendly",
    isFallbackCompetition: true,
    tag: "友谊赛",
    raw,
  };
}

function translateLeague(name = "") {
  return aliases.leagues?.[name] || name || "国际友谊赛";
}

function translateTeam(name = "") {
  return aliases.teams?.[name] || name || "";
}

function normalizeStatusShort(status = "") {
  const value = String(status).toUpperCase();

  if (["FT", "AET", "PEN"].includes(value)) {
    return "finished";
  }

  if (["1H", "HT", "2H", "LIVE", "ET", "BT", "P"].includes(value)) {
    return "live";
  }

  if (["PST", "CANC", "ABD", "SUSP"].includes(value)) {
    return "postponed";
  }

  if (["NS", "TBD"].includes(value)) {
    return "not_started";
  }

  return "unknown";
}

function getTimeZoneDateParts(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatChinaDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getTimeZoneDateParts(new Date());
  }

  return getTimeZoneDateParts(date);
}

function readNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
