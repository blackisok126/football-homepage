import aliases from "../../../../data/football-cn-aliases.json" with { type: "json" };
import { SOURCE_STATUS } from "../types.js";
import { getWorldCupConfig } from "../worldCupConfig.js";

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";

export async function fetchWorldCupMatches({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const key = apiKey || env.API_FOOTBALL_KEY || env.FOOTBALL_API_KEY;

  if (!key) {
    throw new Error("API_FOOTBALL_KEY is missing");
  }

  const config = getWorldCupConfig(env);
  const normalizedBaseUrl = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  const requestUrl = new URL(`${normalizedBaseUrl}/fixtures`);
  requestUrl.searchParams.set("league", String(config.leagueId));
  requestUrl.searchParams.set("season", String(config.season));
  requestUrl.searchParams.set("timezone", config.timezone);

  const response = await fetchImpl(requestUrl, {
    headers: {
      Accept: "application/json",
      "x-apisports-key": key,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football World Cup request failed: ${response.status}`);
  }

  const payload = await response.json();
  const fixtures = Array.isArray(payload.response) ? payload.response : [];
  const fetchedAt = new Date().toISOString();
  const matches = fixtures.map((fixture) =>
    normalizeWorldCupFixture(fixture, {
      fetchedAt,
      season: config.season,
    }),
  );

  return {
    success: true,
    source: "api_football",
    sourceStatus: SOURCE_STATUS.API,
    fetchedAt,
    leagueId: config.leagueId,
    season: config.season,
    matches,
    raw: payload,
  };
}

export function worldCupMatchToSupabaseRow(match) {
  return {
    match_key: match.matchKey,
    source: match.source,
    fixture_id: match.fixtureId,
    league_id: match.leagueId,
    league_name: match.leagueName,
    league_name_cn: match.leagueNameCn,
    season: match.season,
    round: match.round,
    group_name: match.groupName,
    kickoff_time: match.kickoffTime,
    venue_name: match.venueName,
    venue_city: match.venueCity,
    home_team_id: match.homeTeamId,
    away_team_id: match.awayTeamId,
    home_team_name: match.homeTeamName,
    away_team_name: match.awayTeamName,
    home_team_name_cn: match.homeTeamNameCn,
    away_team_name_cn: match.awayTeamNameCn,
    home_logo: match.homeLogo,
    away_logo: match.awayLogo,
    status_short: match.statusShort,
    status_long: match.statusLong,
    status_cn: match.statusCn,
    elapsed: match.elapsed,
    home_score: match.homeScore,
    away_score: match.awayScore,
    halftime_score: match.halftimeScore,
    fulltime_score: match.fulltimeScore,
    raw: match.raw,
    fetched_at: match.fetchedAt,
    updated_at: match.fetchedAt,
  };
}

export function worldCupRowToClientMatch(row = {}) {
  return {
    id: row.match_key || String(row.fixture_id || ""),
    matchKey: row.match_key,
    matchDate: formatChinaDate(row.kickoff_time),
    kickoffTime: row.kickoff_time,
    league: row.league_name_cn || row.league_name || "世界杯",
    leagueCn: row.league_name_cn || row.league_name || "世界杯",
    homeTeam: row.home_team_name_cn || row.home_team_name || "主队待定",
    homeTeamCn: row.home_team_name_cn || row.home_team_name || "主队待定",
    awayTeam: row.away_team_name_cn || row.away_team_name || "客队待定",
    awayTeamCn: row.away_team_name_cn || row.away_team_name || "客队待定",
    homeLogo: row.home_logo || "",
    awayLogo: row.away_logo || "",
    status: normalizeStatusShort(row.status_short),
    statusCn: row.status_cn || translateStatus(row.status_long, row.status_short),
    homeScore: toNullableNumber(row.home_score),
    awayScore: toNullableNumber(row.away_score),
    halftimeScore: row.halftime_score || "",
    fulltimeScore: row.fulltime_score || "",
    round: row.round || row.group_name || null,
    groupName: row.group_name || "",
    venueName: row.venue_name || "",
    venueCity: row.venue_city || "",
    source: row.source || "api_football",
    sourceStatus: SOURCE_STATUS.CACHE,
    updatedAt: row.updated_at || row.fetched_at || new Date().toISOString(),
  };
}

function normalizeWorldCupFixture(raw = {}, meta) {
  const fixture = raw.fixture || {};
  const league = raw.league || {};
  const teams = raw.teams || {};
  const goals = raw.goals || {};
  const score = raw.score || {};
  const fixtureId = fixture.id;
  const season = Number(league.season || meta.season);
  const statusLong = fixture.status?.long || "";
  const statusShort = fixture.status?.short || "";

  return {
    matchKey: `api_football:worldcup:${season}:${fixtureId}`,
    source: "api_football",
    fixtureId,
    leagueId: league.id || 1,
    leagueName: league.name || "World Cup",
    leagueNameCn: translateLeague(league.name || "World Cup"),
    season,
    round: league.round || "",
    groupName: parseGroupName(league.round || ""),
    kickoffTime: fixture.date || new Date().toISOString(),
    venueName: fixture.venue?.name || "",
    venueCity: fixture.venue?.city || "",
    homeTeamId: teams.home?.id || null,
    awayTeamId: teams.away?.id || null,
    homeTeamName: teams.home?.name || "",
    awayTeamName: teams.away?.name || "",
    homeTeamNameCn: translateTeam(teams.home?.name || ""),
    awayTeamNameCn: translateTeam(teams.away?.name || ""),
    homeLogo: teams.home?.logo || "",
    awayLogo: teams.away?.logo || "",
    statusShort,
    statusLong,
    statusCn: translateStatus(statusLong, statusShort),
    elapsed: toNullableNumber(fixture.status?.elapsed),
    homeScore: toNullableNumber(goals.home),
    awayScore: toNullableNumber(goals.away),
    halftimeScore: formatScore(score.halftime),
    fulltimeScore: formatScore(score.fulltime),
    raw,
    fetchedAt: meta.fetchedAt,
  };
}

function translateLeague(name) {
  return aliases.leagues?.[name] || name || "世界杯";
}

function translateTeam(name) {
  return aliases.teams?.[name] || name || "";
}

function translateStatus(longStatus = "", shortStatus = "") {
  return aliases.status?.[longStatus] || aliases.status?.[shortStatus] || longStatus || "待确认";
}

function normalizeStatusShort(statusShort = "") {
  if (["FT", "AET", "PEN"].includes(statusShort)) {
    return "finished";
  }

  if (["1H", "2H", "HT", "ET", "BT", "P"].includes(statusShort)) {
    return "live";
  }

  if (["PST", "CANC"].includes(statusShort)) {
    return "postponed";
  }

  if (["NS", "TBD"].includes(statusShort)) {
    return "not_started";
  }

  return "unknown";
}

function parseGroupName(round = "") {
  const match = String(round).match(/Group\s+([A-H])/i);
  return match ? `小组 ${match[1].toUpperCase()}` : "";
}

function formatScore(score = {}) {
  if (score.home === null || score.home === undefined || score.away === null || score.away === undefined) {
    return "";
  }

  return `${score.home}-${score.away}`;
}

function formatChinaDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
