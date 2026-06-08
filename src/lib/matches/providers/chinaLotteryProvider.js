import { SOURCE_STATUS } from "../types.js";
import { createMatchId, formatMatchDate, normalizeMatchStatus } from "../matchAdapter.js";

const LOTTERY_PAGE = "https://www.lottery.gov.cn/jc/zqszsc/";
const SPORTTERY_API =
  "https://webapi.sporttery.cn/gateway/uniform/football/getMatchListV1.qry?clientCode=3001";
const SPORTTERY_PAGE = "https://www.sporttery.cn/jc/zqszsc/index.html";
const DISCOVERY_KEYWORDS = /(match|jc|zq|football|schedule|pool|odds|zqszsc|getMatchList)/i;

export async function fetchChinaLotteryMatches({ fetchImpl = fetch } = {}) {
  const fetchedAt = new Date().toISOString();
  const errors = [];
  const candidates = await discoverLotteryEndpoints({ fetchImpl, errors });

  for (const url of candidates) {
    try {
      const payload = await fetchJson(url, {
        fetchImpl,
        referer: url.includes("sporttery.cn") ? SPORTTERY_PAGE : LOTTERY_PAGE,
      });
      const matches = normalizeLotteryPayload(payload, {
        fetchedAt,
        sourceUrl: url,
      });

      if (matches.length) {
        return {
          success: true,
          source: "china_lottery",
          sourceStatus: SOURCE_STATUS.API,
          fetchedAt,
          matches,
          errors,
          raw: payload,
        };
      }

      errors.push(`${url}: 未解析到赛事`);
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }

  return {
    success: false,
    source: "china_lottery",
    sourceStatus: SOURCE_STATUS.ERROR,
    fetchedAt,
    matches: [],
    errors,
    raw: null,
  };
}

export function lotteryMatchToSupabaseRow(match) {
  return {
    match_key: match.matchKey,
    source: match.source || "china_lottery",
    issue_date: match.issueDate,
    match_no: match.matchNo,
    lottery_no: match.lotteryNo,
    league_cn: match.leagueCn,
    home_team_cn: match.homeTeamCn,
    away_team_cn: match.awayTeamCn,
    kickoff_time: match.kickoffTime,
    sale_deadline: match.saleDeadline,
    status: match.status,
    rq: toNullableInteger(match.rq),
    score: match.score,
    half_score: match.halfScore,
    spf_win: toNullableNumber(match.spf?.win),
    spf_draw: toNullableNumber(match.spf?.draw),
    spf_lose: toNullableNumber(match.spf?.lose),
    rqspf_win: toNullableNumber(match.rqspf?.win),
    rqspf_draw: toNullableNumber(match.rqspf?.draw),
    rqspf_lose: toNullableNumber(match.rqspf?.lose),
    raw: match.raw || null,
    fetched_at: match.fetchedAt,
    updated_at: match.fetchedAt,
  };
}

export function lotteryRowToClientMatch(row = {}) {
  const score = parseScore(row.score);

  return {
    id: row.match_key || row.id,
    matchKey: row.match_key,
    matchDate: formatMatchDate(row.kickoff_time),
    kickoffTime: row.kickoff_time,
    league: row.league_cn || "竞彩足球",
    leagueCn: row.league_cn || "竞彩足球",
    homeTeam: row.home_team_cn || "主队待定",
    homeTeamCn: row.home_team_cn || "主队待定",
    awayTeam: row.away_team_cn || "客队待定",
    awayTeamCn: row.away_team_cn || "客队待定",
    status: normalizeMatchStatus(row.status),
    homeScore: score?.home ?? null,
    awayScore: score?.away ?? null,
    round: row.match_no || null,
    matchNo: row.match_no || "",
    lotteryNo: row.lottery_no || "",
    issueDate: row.issue_date || "",
    saleDeadline: row.sale_deadline || null,
    rq: toNullableInteger(row.rq),
    score: row.score || "",
    halfScore: row.half_score || "",
    spf: {
      win: toNullableNumber(row.spf_win),
      draw: toNullableNumber(row.spf_draw),
      lose: toNullableNumber(row.spf_lose),
    },
    rqspf: {
      win: toNullableNumber(row.rqspf_win),
      draw: toNullableNumber(row.rqspf_draw),
      lose: toNullableNumber(row.rqspf_lose),
    },
    source: row.source || "china_lottery",
    sourceStatus: SOURCE_STATUS.CACHE,
    updatedAt: row.updated_at || row.fetched_at || new Date().toISOString(),
  };
}

async function discoverLotteryEndpoints({ fetchImpl, errors }) {
  const candidates = [SPORTTERY_API];

  try {
    const html = await fetchText(LOTTERY_PAGE, { fetchImpl, referer: LOTTERY_PAGE });
    const urls = extractCandidateUrls(html, LOTTERY_PAGE);

    for (const url of urls) {
      if (!candidates.includes(url)) {
        candidates.push(url);
      }
    }

    for (const scriptUrl of extractScriptUrls(html, LOTTERY_PAGE)) {
      try {
        const script = await fetchText(scriptUrl, { fetchImpl, referer: LOTTERY_PAGE });
        for (const url of extractCandidateUrls(script, scriptUrl)) {
          if (!candidates.includes(url)) {
            candidates.push(url);
          }
        }
      } catch (error) {
        errors.push(`${scriptUrl}: ${error.message}`);
      }
    }
  } catch (error) {
    errors.push(`${LOTTERY_PAGE}: ${error.message}`);
  }

  return candidates.filter((url) => DISCOVERY_KEYWORDS.test(url));
}

function normalizeLotteryPayload(payload, meta) {
  const groups = payload?.value?.matchInfoList;

  if (Array.isArray(groups)) {
    return groups.flatMap((group) => {
      const issueDate = cleanupText(group.businessDate || group.matchNumDate || "");
      return (group.subMatchList || [])
        .map((item) => normalizeSportteryItem(item, issueDate, meta))
        .filter(Boolean);
    });
  }

  const possibleMatches = findArrays(payload)
    .flat()
    .filter((item) => item && typeof item === "object");

  return possibleMatches
    .map((item) => normalizeGenericLotteryItem(item, meta))
    .filter(Boolean);
}

function normalizeSportteryItem(item, issueDate, meta) {
  const homeTeamCn = cleanupText(item.homeTeamAllName || item.homeTeamAbbName || "");
  const awayTeamCn = cleanupText(item.awayTeamAllName || item.awayTeamAbbName || "");
  const matchNo = cleanupText(item.matchNumStr || item.matchNum || "");

  if (!homeTeamCn || !awayTeamCn || !matchNo) {
    return null;
  }

  const matchDate = cleanupText(item.matchDate || issueDate || formatMatchDate(new Date()));
  const kickoffTime = toChinaIso(`${matchDate} ${cleanupText(item.matchTime || "")}`);
  const saleDeadline = item.buyEndTime ? toChinaIso(cleanupText(item.buyEndTime)) : kickoffTime;
  const pools = parseSportteryPools(item.poolList || []);

  return createLotteryMatch({
    issueDate: issueDate || matchDate,
    matchNo,
    lotteryNo: cleanupText(item.matchId || item.sportteryMatchId || ""),
    leagueCn: cleanupText(item.leagueAbbName || item.leagueAllName || "竞彩足球"),
    homeTeamCn,
    awayTeamCn,
    kickoffTime,
    saleDeadline,
    status: normalizeLotteryStatus(item.matchStatus || item.sellStatus),
    rq: pools.rq,
    score: cleanupText(item.score || item.fullScore || ""),
    halfScore: cleanupText(item.halfScore || ""),
    spf: pools.spf,
    rqspf: pools.rqspf,
    raw: item,
    fetchedAt: meta.fetchedAt,
  });
}

function normalizeGenericLotteryItem(item, meta) {
  const matchNo = cleanupText(item.match_no || item.matchNo || item.matchNumStr || "");
  const homeTeamCn = cleanupText(item.home_team_cn || item.homeTeam || item.homeTeamCn || "");
  const awayTeamCn = cleanupText(item.away_team_cn || item.awayTeam || item.awayTeamCn || "");

  if (!matchNo || !homeTeamCn || !awayTeamCn) {
    return null;
  }

  const issueDate = cleanupText(item.issue_date || item.issueDate || item.matchDate || "");
  const kickoffTime = toChinaIso(cleanupText(item.kickoff_time || item.kickoffTime || item.matchTime || ""));

  return createLotteryMatch({
    issueDate: issueDate || formatMatchDate(kickoffTime),
    matchNo,
    lotteryNo: cleanupText(item.lottery_no || item.lotteryNo || item.matchId || ""),
    leagueCn: cleanupText(item.league_cn || item.leagueCn || item.leagueName || "竞彩足球"),
    homeTeamCn,
    awayTeamCn,
    kickoffTime,
    saleDeadline: item.sale_deadline || item.saleDeadline || null,
    status: normalizeLotteryStatus(item.status || item.matchStatus || item.sellStatus),
    rq: item.rq ?? item.handicap ?? item.goalLine,
    score: cleanupText(item.score || ""),
    halfScore: cleanupText(item.half_score || item.halfScore || ""),
    spf: {
      win: item.spf_win ?? item.spfWin,
      draw: item.spf_draw ?? item.spfDraw,
      lose: item.spf_lose ?? item.spfLose,
    },
    rqspf: {
      win: item.rqspf_win ?? item.rqspfWin,
      draw: item.rqspf_draw ?? item.rqspfDraw,
      lose: item.rqspf_lose ?? item.rqspfLose,
    },
    raw: item,
    fetchedAt: meta.fetchedAt,
  });
}

function createLotteryMatch(match) {
  const issueDate = match.issueDate || formatMatchDate(match.kickoffTime);
  const matchKey = `china_lottery:${issueDate}:${match.matchNo}`;

  return {
    ...match,
    id: createMatchId(matchKey),
    matchKey,
    issueDate,
    source: "china_lottery",
    sourceStatus: SOURCE_STATUS.API,
    rq: toNullableInteger(match.rq),
    spf: normalizeOdds(match.spf),
    rqspf: normalizeOdds(match.rqspf),
  };
}

function parseSportteryPools(poolList = []) {
  const result = {
    rq: null,
    spf: { win: null, draw: null, lose: null },
    rqspf: { win: null, draw: null, lose: null },
  };

  for (const pool of poolList || []) {
    const code = cleanupText(pool.poolCode || "").toUpperCase();

    if (code === "HAD") {
      result.spf = normalizeOdds({
        win: pool.h || pool.home || pool.win || pool.hadH,
        draw: pool.d || pool.draw || pool.hadD,
        lose: pool.a || pool.away || pool.lose || pool.hadA,
      });
    }

    if (code === "HHAD") {
      result.rq = toNullableInteger(
        pool.goalLine || pool.handicap || pool.hhadFixedodds || pool.fixedOdds,
      );
      result.rqspf = normalizeOdds({
        win: pool.h || pool.home || pool.win || pool.hhadH,
        draw: pool.d || pool.draw || pool.hhadD,
        lose: pool.a || pool.away || pool.lose || pool.hhadA,
      });
    }
  }

  return result;
}

async function fetchJson(url, options) {
  const text = await fetchText(url, options);

  if (/^\s*</.test(text)) {
    throw new Error("接口返回 HTML");
  }

  return JSON.parse(text);
}

async function fetchText(url, { fetchImpl, referer }) {
  const response = await fetchImpl(url, {
    headers: buildHeaders(referer),
  });

  if (!response.ok) {
    throw new Error(`请求失败 ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const buffer = await response.arrayBuffer();
  const encoding = /gbk|gb2312|gb18030/i.test(contentType) ? "gb18030" : "utf-8";

  return new TextDecoder(encoding).decode(buffer);
}

function buildHeaders(referer) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    Accept: "application/json,text/html,*/*",
    Referer: referer || LOTTERY_PAGE,
    "X-Requested-With": "XMLHttpRequest",
  };
}

function extractScriptUrls(html, baseUrl) {
  return [...String(html || "").matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1], baseUrl))
    .filter(Boolean);
}

function extractCandidateUrls(text, baseUrl) {
  const candidates = [
    ...String(text || "").matchAll(/https?:\/\/[^"'\s<>]+/gi),
    ...String(text || "").matchAll(/["']([^"']*(?:match|jc|zq|football|schedule|pool|odds)[^"']*)["']/gi),
  ];

  return candidates
    .map((match) => toAbsoluteUrl(match[1] || match[0], baseUrl))
    .filter((url) => url && DISCOVERY_KEYWORDS.test(url));
}

function toAbsoluteUrl(value, baseUrl) {
  try {
    return new URL(String(value || "").replace(/\\\//g, "/"), baseUrl).href;
  } catch {
    return "";
  }
}

function findArrays(value, arrays = []) {
  if (Array.isArray(value)) {
    arrays.push(value);
    value.forEach((item) => findArrays(item, arrays));
    return arrays;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => findArrays(item, arrays));
  }

  return arrays;
}

function normalizeLotteryStatus(value) {
  const text = cleanupText(value);

  if (/完|结束|已开奖|finished/i.test(text)) {
    return "finished";
  }

  if (/进行|live|1h|2h|ht/i.test(text)) {
    return "live";
  }

  if (/延期|推迟|取消|postponed|cancel/i.test(text)) {
    return "postponed";
  }

  return "not_started";
}

function normalizeOdds(odds = {}) {
  return {
    win: toNullableNumber(odds.win),
    draw: toNullableNumber(odds.draw),
    lose: toNullableNumber(odds.lose),
  };
}

function parseScore(score) {
  const match = String(score || "").match(/(\d+)\s*[-:：]\s*(\d+)/);

  if (!match) {
    return null;
  }

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  };
}

function toChinaIso(value) {
  const text = cleanupText(value);
  const match = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2}))?/,
  );

  if (!match) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 8,
      Number(minute),
      Number(second),
    ),
  ).toISOString();
}

function cleanupText(value) {
  return String(value || "")
    .replace(/直播|视频|集锦|录像|前瞻|免费/gi, "")
    .replace(/[|｜]/g, " ")
    .trim();
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function toNullableInteger(value) {
  const number = toNullableNumber(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}
