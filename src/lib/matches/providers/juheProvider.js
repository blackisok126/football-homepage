import aliases from "../../../../data/football-cn-aliases.json" with { type: "json" };
import { MATCH_STATUS, SOURCE_STATUS } from "../types.js";

const DEFAULT_TIME_ZONE = "Asia/Shanghai";

export function hasJuheConfig(env = process.env) {
  return Boolean(
    String(env.JUHE_API_KEY || "").trim() &&
      String(env.JUHE_WORLD_CUP_API_URL || "").trim(),
  );
}

export async function fetchJuheWorldCupMatches({
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const apiKey = String(env.JUHE_API_KEY || "").trim();
  const endpoint = String(env.JUHE_WORLD_CUP_API_URL || "").trim();

  if (!apiKey || !endpoint) {
    return {
      success: false,
      reason: "missing_config",
      source: "juhe_worldcup",
      matches: [],
    };
  }

  const requestUrl = new URL(endpoint);
  requestUrl.searchParams.set("key", apiKey);

  if (!requestUrl.searchParams.has("dtype")) {
    requestUrl.searchParams.set("dtype", "json");
  }

  const response = await fetchImpl(requestUrl, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "football-matchday-homepage/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Juhe World Cup request failed: ${response.status}`);
  }

  const payload = await response.json();
  const records = extractMatchRecords(payload);
  const lastSyncedAt = new Date().toISOString();
  const matches = records.map((record, index) =>
    normalizeJuheMatch(record, {
      index,
      lastSyncedAt,
      source: "juhe_worldcup",
    }),
  );

  return {
    success: true,
    source: "juhe_worldcup",
    sourceStatus: SOURCE_STATUS.API,
    updatedAt: lastSyncedAt,
    matches,
    raw: payload,
  };
}

export function juheMatchToSupabaseRow(match) {
  return {
    match_key: match.matchKey,
    source: match.source,
    source_match_id: match.sourceFixtureId,
    match_time: match.matchTime,
    cn_league_name: match.cnLeagueName,
    cn_home_name: match.cnHomeName,
    cn_away_name: match.cnAwayName,
    status: match.status,
    round_name: match.round,
    venue: match.venue,
    priority: match.priority,
    last_synced_at: match.lastSyncedAt,
    raw_data: match.raw,
    league_name: match.leagueName,
    league_name_cn: match.cnLeagueName,
    home_team_name: match.homeTeamName,
    home_team_name_cn: match.cnHomeName,
    away_team_name: match.awayTeamName,
    away_team_name_cn: match.cnAwayName,
    kickoff_time: match.matchTime,
    venue_name: match.venue,
    status_short: match.status,
    status_cn: translateStatus(match.status),
    home_score: match.homeScore,
    away_score: match.awayScore,
    round: match.round,
    group_name: match.displayGroup,
    raw: match.raw,
    fetched_at: match.lastSyncedAt,
    updated_at: match.lastSyncedAt,
  };
}

export function juheRowToClientMatch(row = {}) {
  const matchTime = row.match_time || row.kickoff_time;
  return {
    id: row.match_key || row.source_match_id || "",
    matchKey: row.match_key || "",
    matchDate: formatChinaDate(matchTime),
    kickoffTime: matchTime,
    league: row.cn_league_name || row.league_name_cn || row.league_name || "世界杯",
    leagueCn: row.cn_league_name || row.league_name_cn || row.league_name || "世界杯",
    displayLeague: row.cn_league_name || row.league_name_cn || row.league_name || "世界杯",
    homeTeam: row.cn_home_name || row.home_team_name_cn || row.home_team_name || "主队待定",
    homeTeamCn: row.cn_home_name || row.home_team_name_cn || row.home_team_name || "主队待定",
    awayTeam: row.cn_away_name || row.away_team_name_cn || row.away_team_name || "客队待定",
    awayTeamCn: row.cn_away_name || row.away_team_name_cn || row.away_team_name || "客队待定",
    status: normalizeStatus(row.status || row.status_short),
    statusCn: row.status_cn || translateStatus(row.status || row.status_short),
    homeScore: toNullableNumber(row.home_score),
    awayScore: toNullableNumber(row.away_score),
    round: row.round_name || row.round || row.group_name || null,
    venueName: row.venue || row.venue_name || "",
    source: row.source || "juhe_worldcup",
    sourceStatus: SOURCE_STATUS.CACHE,
    updatedAt: row.updated_at || row.last_synced_at || row.fetched_at || new Date().toISOString(),
    priority: row.priority || 0,
    isFeatured: false,
  };
}

function normalizeJuheMatch(raw = {}, meta) {
  const leagueName = pickString(raw, [
    "league_name",
    "league",
    "match_name",
    "competition",
    "matchType",
    "赛事",
    "联赛",
  ]) || "2026 FIFA World Cup";
  const cnLeagueName = pickString(raw, ["cn_league_name", "league_cn", "赛事名称", "联赛名称"]) ||
    translateLeague(leagueName);
  const homeTeamName = pickString(raw, ["home_team_name", "host_team_name", "home", "homeTeam", "hostTeam", "主队"]);
  const awayTeamName = pickString(raw, ["away_team_name", "guest_team_name", "away", "awayTeam", "guestTeam", "客队"]);
  const cnHomeName = pickString(raw, ["cn_home_name", "home_cn", "host_team_name", "主队名称"]) ||
    translateTeam(homeTeamName);
  const cnAwayName = pickString(raw, ["cn_away_name", "away_cn", "guest_team_name", "客队名称"]) ||
    translateTeam(awayTeamName);
  const matchTime = normalizeMatchTime(
    pickString(raw, [
      "match_time",
      "matchTime",
      "time",
      "date",
      "date_time",
      "start_time",
      "startTime",
      "比赛时间",
      "开赛时间",
    ]),
  );
  const sourceFixtureId = pickString(raw, ["team_id", "id", "match_id", "matchId", "fixture_id", "赛事id"]) ||
    `${meta.source}:${meta.index}`;
  const status = normalizeStatus(pickString(raw, ["status", "state", "match_status", "状态"]));
  const homeScore = toNullableNumber(pickString(raw, ["home_score", "homeScore", "score_home", "主队比分"]));
  const awayScore = toNullableNumber(pickString(raw, ["away_score", "awayScore", "score_away", "客队比分"]));

  const match = {
    source: meta.source,
    sourceFixtureId,
    leagueName: leagueName || cnLeagueName || "World Cup",
    cnLeagueName: cnLeagueName || leagueName || "世界杯",
    homeTeamName: homeTeamName || cnHomeName || "",
    cnHomeName: cnHomeName || homeTeamName || "主队待定",
    awayTeamName: awayTeamName || cnAwayName || "",
    cnAwayName: cnAwayName || awayTeamName || "客队待定",
    matchTime,
    status,
    venue: pickString(raw, ["venue", "stadium", "球场", "场馆"]),
    displayGroup: cnLeagueName || leagueName || "世界杯",
    priority: 50,
    isFeatured: false,
    homeScore,
    awayScore,
    round: pickString(raw, ["round", "match_type_name", "group", "轮次", "小组"]),
    raw,
    lastSyncedAt: meta.lastSyncedAt,
  };

  return {
    ...match,
    matchKey: createJuheMatchKey(match),
  };
}

function extractMatchRecords(payload) {
  const scheduleGroups = payload?.result?.data || payload?.data;

  if (Array.isArray(scheduleGroups)) {
    const schedules = scheduleGroups.flatMap((group) => {
      if (Array.isArray(group?.schedule_list)) {
        return group.schedule_list.map((match) => ({
          ...match,
          match_type_name: match.match_type_name || group.match_type_name,
        }));
      }

      return [];
    });

    if (schedules.length) {
      return schedules;
    }
  }

  const directCandidates = [
    payload?.result,
    payload?.result?.list,
    payload?.result?.matches,
    payload?.data,
    payload?.data?.list,
    payload?.data?.matches,
    payload?.matches,
    payload?.list,
  ];
  const direct = directCandidates.find(Array.isArray);

  if (direct) {
    return direct;
  }

  return findFirstArrayOfObjects(payload) || [];
}

function findFirstArrayOfObjects(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    return value.some((item) => item && typeof item === "object") ? value : null;
  }

  for (const item of Object.values(value)) {
    const result = findFirstArrayOfObjects(item);
    if (result) {
      return result;
    }
  }

  return null;
}

function createJuheMatchKey(match) {
  const time = new Date(match.matchTime);
  const timeKey = Number.isNaN(time.getTime())
    ? "unknown-time"
    : time.toISOString().slice(0, 16);
  const league = normalizeName(match.cnLeagueName || match.leagueName);
  const home = normalizeName(match.cnHomeName || match.homeTeamName);
  const away = normalizeName(match.cnAwayName || match.awayTeamName);
  return `juhe:${timeKey}:${league}:${home}:${away}`;
}

function pickString(source, keys) {
  for (const key of keys) {
    const value = source?.[key];

    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function normalizeMatchTime(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const normalized = String(value).trim().replace(/\//g, "-");

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    return new Date(`${normalized.replace(/\s+/, "T")}+08:00`).toISOString();
  }

  const parsed = new Date(normalized);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const chinaParsed = new Date(`${normalized}+08:00`);
  return Number.isNaN(chinaParsed.getTime()) ? new Date().toISOString() : chinaParsed.toISOString();
}

function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function translateLeague(name = "") {
  if (/world\s*cup|世界杯/i.test(name)) {
    return "2026 美加墨世界杯";
  }

  return aliases.leagues?.[name] || name || "2026 美加墨世界杯";
}

function translateTeam(name = "") {
  return aliases.teams?.[name] || name || "";
}

function translateStatus(status = "") {
  return aliases.status?.[status] || status || "待确认";
}

function normalizeStatus(status = "") {
  const value = String(status).toLowerCase();

  if (["ft", "aet", "pen", "finished", "match finished", "已结束", "完场"].includes(value)) {
    return MATCH_STATUS.FINISHED;
  }

  if (["1h", "2h", "ht", "live", "in_play", "进行中", "比赛中"].includes(value)) {
    return MATCH_STATUS.LIVE;
  }

  if (["pst", "canc", "postponed", "cancelled", "延期"].includes(value)) {
    return MATCH_STATUS.POSTPONED;
  }

  if (["ns", "tbd", "scheduled", "timed", "not_started", "未开始", "未开赛"].includes(value)) {
    return MATCH_STATUS.NOT_STARTED;
  }

  return Object.values(MATCH_STATUS).includes(value) ? value : MATCH_STATUS.UNKNOWN;
}

function formatChinaDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIME_ZONE,
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
