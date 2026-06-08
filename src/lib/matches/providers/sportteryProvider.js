import { SOURCE_STATUS } from "../types.js";
import { adaptLegacyMatch, formatMatchDate } from "../matchAdapter.js";

const SPORTTERY_API =
  "https://webapi.sporttery.cn/gateway/uniform/football/getMatchListV1.qry?clientCode=3001";
const SPORTTERY_PAGE = "https://www.sporttery.cn/jc/zqszsc/index.html";
const SOURCE_NAME = "sporttery";

export async function getSportteryProviderRecords({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(SPORTTERY_API, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/json,text/plain",
      referer: SPORTTERY_PAGE,
      "x-requested-with": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Sporttery request failed: ${response.status}`);
  }

  const payload = await response.json();

  if (String(payload.errorCode) !== "0" || !payload.value?.matchInfoList) {
    throw new Error("Sporttery payload is not available");
  }

  const updatedAt = new Date().toISOString();
  const legacyMatches = [];

  for (const dateGroup of payload.value.matchInfoList) {
    const groupDate = cleanupText(dateGroup.businessDate || dateGroup.matchNumDate || "");

    for (const item of dateGroup.subMatchList || []) {
      const legacyMatch = parseSportteryMatch(item, groupDate);

      if (legacyMatch) {
        legacyMatches.push(legacyMatch);
      }
    }
  }

  return {
    source: SOURCE_NAME,
    sourceStatus: SOURCE_STATUS.API,
    updatedAt,
    records: legacyMatches.map((legacyMatch) => ({
      match: adaptLegacyMatch(legacyMatch, {
        source: SOURCE_NAME,
        sourceStatus: SOURCE_STATUS.API,
        updatedAt,
      }),
      raw: legacyMatch,
    })),
    raw: payload,
  };
}

function parseSportteryMatch(item, groupDate) {
  const homeTeam = cleanupText(item.homeTeamAllName || item.homeTeamAbbName || "");
  const awayTeam = cleanupText(item.awayTeamAllName || item.awayTeamAbbName || "");

  if (!homeTeam || !awayTeam) {
    return null;
  }

  const matchDate = cleanupText(item.matchDate || groupDate || formatMatchDate(new Date()));
  const matchTime = cleanupText(item.matchTime || "");
  const kickoffTime = toChinaIso(`${matchDate} ${matchTime}`);
  const matchId = cleanupText(item.matchId || item.sportteryMatchId || "");

  return {
    matchNo: cleanupText(item.matchNumStr || item.matchNum || ""),
    competition: cleanupText(item.leagueAbbName || item.leagueAllName || "竞彩足球"),
    kickoffTime,
    homeTeam,
    awayTeam,
    status: sportterySellStatus(item.sellStatus) || inferStatus(kickoffTime),
    round: cleanupText(item.matchNumStr || item.matchNum || "") || null,
    sourceUrl: matchId
      ? `https://www.sporttery.cn/jc/zqdz/index.html?showType=2&mid=${encodeURIComponent(
          matchId,
        )}`
      : SPORTTERY_PAGE,
  };
}

function sportterySellStatus(sellStatus) {
  if (String(sellStatus) === "2") {
    return "暂停销售";
  }

  return "";
}

function inferStatus(kickoffTime) {
  const kickoff = Date.parse(kickoffTime);
  const now = Date.now();

  if (Number.isNaN(kickoff)) {
    return "待定";
  }

  if (now > kickoff + 120 * 60 * 1000) {
    return "已结束";
  }

  if (now >= kickoff) {
    return "进行中";
  }

  return "未开始";
}

function toChinaIso(value) {
  const match = String(value || "").match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const utcTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 8,
    Number(minute),
    Number(second),
  );

  return new Date(utcTime).toISOString();
}

function cleanupText(text) {
  return String(text || "")
    .replace(/直播|视频|集锦|录像|前瞻|免费/gi, "")
    .replace(/[|｜]/g, " ")
    .trim();
}
