import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SOURCE_URLS = [
  "https://www.lottery.gov.cn/jc/zqszsc/",
  "https://www.sporttery.cn/jc/zqszsc/index.html",
  "https://jc.titan007.com/index.aspx",
];
const OFFICIAL_SPORTTERY_API =
  "https://webapi.sporttery.cn/gateway/uniform/football/getMatchListV1.qry?clientCode=3001";
const OFFICIAL_SPORTTERY_PAGE = "https://www.sporttery.cn/jc/zqszsc/index.html";
const SOURCE_URLS = (process.env.MATCH_SOURCE_URL || DEFAULT_SOURCE_URLS.join(","))
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const OUTPUT_FILE = new URL("../data/matches.json", import.meta.url);
const OCR_FALLBACK_IMAGE = process.env.MATCH_OCR_IMAGE
  ? resolve(process.env.MATCH_OCR_IMAGE)
  : fileURLToPath(new URL("../data/matches-screenshot.png", import.meta.url));
const OCR_SOURCE_LABEL = "网页截图 OCR";
const TIME_ZONE = "Asia/Shanghai";
const IMPORTANT_COMPETITIONS = [
  "世界杯",
  "欧洲杯",
  "欧冠",
  "欧联",
  "英超",
  "西甲",
  "意甲",
  "德甲",
  "法甲",
  "中超",
  "亚冠",
  "足协杯",
  "友谊赛",
  "国际友谊",
  "国际赛",
];

try {
  const result = await fetchFromSources(SOURCE_URLS);

  const payload = {
    date: getChinaDate(),
    timezone: TIME_ZONE,
    source: result.source,
    updatedAt: new Date().toISOString(),
    matches: result.matches,
  };

  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`已从 ${result.source} 更新 ${result.matches.length} 场赛事`);
} catch (error) {
  await updateFromOcrFallback(error);
}

async function fetchFromSources(sourceUrls) {
  const errors = [];

  for (const sourceUrl of sourceUrls) {
    try {
      const matches = await fetchMatchesFromSource(sourceUrl);

      if (!matches.length) {
        throw new Error("未解析到赛事信息");
      }

      return {
        source: sourceUrl,
        matches: rankMatches(matches).slice(0, 24),
      };
    } catch (error) {
      errors.push(`${sourceUrl}: ${error.message}`);
    }
  }

  throw new Error(errors.join("；"));
}

async function fetchMatchesFromSource(sourceUrl) {
  const host = new URL(sourceUrl).hostname;

  if (host.includes("titan007.com")) {
    return fetchTitan007Matches(sourceUrl);
  }

  if (host.includes("lottery.gov.cn") || host.includes("sporttery.cn")) {
    return fetchOfficialSportteryMatches(sourceUrl);
  }

  const html = await fetchText(sourceUrl);
  return parseTextMatches(html, sourceUrl);
}

async function fetchTitan007Matches(sourceUrl) {
  const dataUrl = new URL("/xml/bf_jc.txt", sourceUrl);
  dataUrl.search = String(Date.now());

  const text = await fetchText(dataUrl.href, { encoding: "utf-8" });
  return parseTitan007Data(text, sourceUrl);
}

async function fetchZhcwMatches(sourceUrl) {
  const apiUrl = new URL("/port/client_json.php", sourceUrl);
  apiUrl.searchParams.set("transactionType", "10002105");
  apiUrl.searchParams.set("tt", Math.random().toString());

  const json = await fetchJson(apiUrl.href, {
    referer: sourceUrl,
  });

  if (!Array.isArray(json.data)) {
    return [];
  }

  return json.data.map((item) => {
    const odds = item.hadOdds || {};

    return {
      matchNo: cleanupText(item.matchNum || item.matchId || ""),
      competition: cleanupText(item.leagueName || "竞彩足球"),
      kickoffTime: toChinaIso(`${item.date} ${item.time}`),
      homeTeam: cleanupText(item.homeName || ""),
      awayTeam: cleanupText(item.guestName || ""),
      status: inferStatus(`${item.date} ${item.time}`),
      handicap: formatHandicap(odds.hhadFixedodds || odds.hadFixedodds),
      odds: {
        win: normalizeOdds(odds.hadH),
        draw: normalizeOdds(odds.hadD),
        lose: normalizeOdds(odds.hadA),
      },
      handicapOdds: {
        win: normalizeOdds(odds.hhadH),
        draw: normalizeOdds(odds.hhadD),
        lose: normalizeOdds(odds.hhadA),
      },
      sourceUrl,
    };
  });
}

async function fetchOfficialSportteryMatches(sourceUrl) {
  const json = await fetchJson(OFFICIAL_SPORTTERY_API, {
    referer: sourceUrl.includes("sporttery.cn") ? sourceUrl : OFFICIAL_SPORTTERY_PAGE,
  });

  if (String(json.errorCode) !== "0" || !json.value?.matchInfoList) {
    return [];
  }

  const matches = [];

  for (const dateGroup of json.value.matchInfoList) {
    const date = cleanupText(dateGroup.businessDate || dateGroup.matchNumDate || "");

    for (const item of dateGroup.subMatchList || []) {
      const match = parseOfficialSportteryMatch(item, date, sourceUrl);

      if (match) {
        matches.push(match);
      }
    }
  }

  return matches;
}

function parseOfficialSportteryMatch(item, groupDate, sourceUrl) {
  const homeTeam = cleanupText(item.homeTeamAllName || item.homeTeamAbbName || "");
  const awayTeam = cleanupText(item.awayTeamAllName || item.awayTeamAbbName || "");

  if (!homeTeam || !awayTeam) {
    return null;
  }

  const matchDate = cleanupText(item.matchDate || groupDate || getChinaDate());
  const matchTime = cleanupText(item.matchTime || "");
  const kickoffTime = toChinaIso(`${matchDate} ${matchTime}`);
  const { odds, handicapOdds, handicap } = parseOfficialSportteryPools(item.poolList);
  const matchId = cleanupText(item.matchId || item.sportteryMatchId || "");
  const detailUrl = matchId
    ? `https://www.sporttery.cn/jc/zqdz/index.html?showType=2&mid=${encodeURIComponent(
        matchId,
      )}`
    : sourceUrl;

  return {
    matchNo: cleanupText(item.matchNumStr || item.matchNum || ""),
    competition: cleanupText(item.leagueAbbName || item.leagueAllName || "竞彩足球"),
    kickoffTime,
    homeTeam,
    awayTeam,
    status: sportterySellStatus(item.sellStatus) || inferStatus(`${matchDate} ${matchTime}`),
    handicap,
    odds,
    handicapOdds,
    sourceUrl: detailUrl,
  };
}

function parseOfficialSportteryPools(poolList = []) {
  const result = {
    odds: null,
    handicapOdds: null,
    handicap: "",
  };

  for (const pool of poolList || []) {
    const code = cleanupText(pool.poolCode || "").toUpperCase();

    if (code === "HAD") {
      result.odds = normalizeOfficialOdds(pool);
    }

    if (code === "HHAD") {
      result.handicapOdds = normalizeOfficialOdds(pool);
      result.handicap = formatHandicap(
        pool.goalLine || pool.handicap || pool.hhadFixedodds || pool.fixedOdds,
      );
    }
  }

  return result;
}

function normalizeOfficialOdds(pool = {}) {
  const odds = {
    win: normalizeOdds(pool.h || pool.home || pool.win || pool.hadH),
    draw: normalizeOdds(pool.d || pool.draw || pool.hadD),
    lose: normalizeOdds(pool.a || pool.away || pool.lose || pool.hadA),
  };

  return odds.win || odds.draw || odds.lose ? odds : null;
}

function sportterySellStatus(sellStatus) {
  if (String(sellStatus) === "1") {
    return "";
  }

  if (String(sellStatus) === "2") {
    return "暂停销售";
  }

  return "未开始";
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: buildHeaders(options.referer),
  });

  if (!response.ok) {
    throw new Error(`抓取失败：${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const buffer = await response.arrayBuffer();
  const encoding =
    options.encoding ||
    (/gbk|gb2312|gb18030/i.test(contentType) ? "gb18030" : "utf-8");

  return new TextDecoder(encoding).decode(buffer);
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);

  if (!text.trim()) {
    throw new Error("接口返回空内容");
  }

  if (/^\s*</.test(text)) {
    throw new Error("接口返回 HTML，可能被站点防护拦截");
  }

  return JSON.parse(text);
}

function buildHeaders(referer) {
  return {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/json,text/plain",
    ...(referer ? { referer, "x-requested-with": "XMLHttpRequest" } : {}),
  };
}

function parseTitan007Data(text, sourceUrl) {
  const [competitionChunk = "", scheduleChunk = ""] = text.split("$");
  const competitionMap = new Map();

  for (const row of competitionChunk.split("!")) {
    const columns = row.split("^");
    const id = columns[0];
    const names = (columns[3] || "").split(",");

    if (id && names[0]) {
      competitionMap.set(id, cleanupText(names[0]));
    }
  }

  return scheduleChunk
    .split("!")
    .map((row) => parseTitan007Schedule(row, competitionMap, sourceUrl))
    .filter(Boolean);
}

function parseTitan007Schedule(row, competitionMap, sourceUrl) {
  const columns = row.split("^");

  if (columns.length < 11) {
    return null;
  }

  const competition = competitionMap.get(columns[5]) || "竞彩足球";
  const homeTeam = cleanupText((columns[8] || "").split(",")[0]);
  const awayTeam = cleanupText((columns[10] || "").split(",")[0]);

  if (!homeTeam || !awayTeam) {
    return null;
  }

  return {
    matchNo: cleanupText(columns[4] || ""),
    competition,
    kickoffTime: toChinaIso(columns[1], { zeroBasedMonth: true }),
    homeTeam,
    awayTeam,
    status: titanStatus(columns[3], columns[11], columns[12]),
    handicap: formatHandicap(columns[22]),
    odds: null,
    handicapOdds: null,
    sourceUrl,
  };
}

function parseTextMatches(html, sourceUrl) {
  const text = decodeHtml(stripTags(html))
    .replace(/\s+/g, " ")
    .replace(/(\d{1,2}:\d{2})/g, "\n$1");

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseMatchLine(line, sourceUrl))
    .filter(Boolean);
}

function parseMatchLine(line, sourceUrl) {
  const timeMatch = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);

  if (!timeMatch) {
    return null;
  }

  const [, time, rest] = timeMatch;
  const versusMatch = rest.match(
    /(.{2,18}?)(?:\s+)([^-\s][^-]{1,28}?)(?:\s*(?:vs|VS|v|对阵|-)\s*)([^-\s][^-]{1,28})(?:\s|$)/,
  );

  if (!versusMatch) {
    return null;
  }

  const competition = cleanupText(versusMatch[1]);
  const homeTeam = cleanupText(versusMatch[2]);
  const awayTeam = cleanupText(versusMatch[3]);

  if (!competition || !homeTeam || !awayTeam) {
    return null;
  }

  return {
    matchNo: "",
    competition,
    kickoffTime: toChinaIso(`${getChinaDate()} ${time}`),
    homeTeam,
    awayTeam,
    status: inferStatus(`${getChinaDate()} ${time}`),
    handicap: "",
    odds: null,
    handicapOdds: null,
    sourceUrl,
  };
}

async function updateFromOcrFallback(fetchError) {
  try {
    const matches = fetchMatchesFromOcrImage(OCR_FALLBACK_IMAGE);

    if (!matches.length) {
      throw new Error("OCR 未解析到赛事信息");
    }

    const payload = {
      date: getChinaDate(),
      timezone: TIME_ZONE,
      source: OCR_SOURCE_LABEL,
      updatedAt: new Date().toISOString(),
      matches: rankMatches(matches).slice(0, 24),
    };

    await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`已从 ${OCR_SOURCE_LABEL} 更新 ${payload.matches.length} 场赛事`);
  } catch (ocrError) {
    await preserveExistingData(
      new Error(`${fetchError.message}；OCR 兜底失败：${ocrError.message}`),
    );
  }
}

function fetchMatchesFromOcrImage(imageUrl) {
  if (!existsSync(imageUrl)) {
    throw new Error(`未找到截图文件 ${imageUrl}`);
  }

  const result = spawnSync("tesseract", [imageUrl, "stdout", "-l", "chi_sim+eng"], {
    encoding: "utf8",
  });

  if (result.error?.code === "ENOENT") {
    throw new Error("未安装 tesseract OCR");
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || result.error?.message || "tesseract 执行失败").trim());
  }

  const text = cleanupOcrText(result.stdout || "");
  return parseOcrMatches(text, OCR_SOURCE_LABEL);
}

function cleanupOcrText(text) {
  return decodeHtml(text)
    .replace(/[|｜]/g, " ")
    .replace(/[：]/g, ":")
    .replace(/[—–]/g, "-")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, " ")
    .trim();
}

function parseOcrMatches(text, sourceUrl) {
  return text
    .replace(/(\d{1,2}:\d{2})/g, "\n$1")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseOcrMatchLine(line, sourceUrl))
    .filter(Boolean);
}

function parseOcrMatchLine(line, sourceUrl) {
  const timeMatch = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);

  if (!timeMatch) {
    return null;
  }

  const [, time, rest] = timeMatch;
  const matchNo = cleanupText(rest.match(/编号\s*([^\s]+(?:\s*\d{3})?)/)?.[1] || "");
  const kickoffText = rest.match(
    /开赛\s*(\d{1,2})\/(\d{1,2})(?:周[一二三四五六日])?\s*(\d{1,2}:\d{2})/,
  );
  const kickoffTime = kickoffText
    ? toChinaIso(`${getChinaYear()}-${kickoffText[1]}-${kickoffText[2]} ${kickoffText[3]}`)
    : toChinaIso(`${getChinaDate()} ${time}`);
  const teams = parseOcrTeams(rest);

  if (!teams) {
    return null;
  }

  const odds = {
    win: normalizeOdds(rest.match(/胜\s*([0-9]+(?:\.[0-9]+)?)/)?.[1]),
    draw: normalizeOdds(rest.match(/平\s*([0-9]+(?:\.[0-9]+)?)/)?.[1]),
    lose: normalizeOdds(rest.match(/(?:负|客胜)\s*([0-9]+(?:\.[0-9]+)?)/)?.[1]),
  };
  const hasOdds = odds.win || odds.draw || odds.lose;

  return {
    matchNo,
    competition: cleanupText(rest.match(/(世界杯|国际友谊|国际赛|英超|西甲|意甲|德甲|法甲|中超|欧冠|欧联)/)?.[1] || "竞彩足球"),
    kickoffTime,
    homeTeam: teams.homeTeam,
    awayTeam: teams.awayTeam,
    status: inferStatusFromText(rest, kickoffTime),
    handicap: formatHandicap(rest.match(/让球\s*([+-]?\d+(?:\.\d+)?)/)?.[1]),
    odds: hasOdds ? odds : null,
    handicapOdds: null,
    sourceUrl,
  };
}

function parseOcrTeams(text) {
  const normalized = text
    .replace(/编号\s*[^\s]+(?:\s*\d{3})?/g, " ")
    .replace(/开赛\s*\d{1,2}\/\d{1,2}(?:周[一二三四五六日])?\s*\d{1,2}:\d{2}/g, " ")
    .replace(/距开赛\s*\S+/g, " ")
    .replace(/比赛(?:进行中|已结束)/g, " ")
    .replace(/未开始|进行中|已结束|查看来源/g, " ")
    .replace(/让球\s*[+-]?\d+(?:\.\d+)?/g, " ")
    .replace(/胜\s*[0-9]+(?:\.[0-9]+)?|平\s*[0-9]+(?:\.[0-9]+)?|负\s*[0-9]+(?:\.[0-9]+)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/(.{1,24}?)\s*(?:VS|vs|Vs|对阵|v)\s*(.{1,24})(?:\s|$)/);

  if (!match) {
    return null;
  }

  return {
    homeTeam: cleanupText(match[1]),
    awayTeam: cleanupText(match[2]),
  };
}

function inferStatusFromText(text, kickoffTime) {
  if (/已结束|完场|比赛已结束/.test(text)) {
    return "已结束";
  }

  if (/进行中|比赛进行中/.test(text)) {
    return "进行中";
  }

  return inferStatus(kickoffTime);
}

function normalizeOdds(value) {
  const text = cleanupText(value || "");
  return text || "";
}

function formatHandicap(value) {
  const text = cleanupText(value || "");

  if (!text) {
    return "";
  }

  return Number(text) > 0 && !text.startsWith("+") ? `+${text}` : text;
}

function rankMatches(matches) {
  return matches
    .filter((match) => match.homeTeam && match.awayTeam)
    .sort((a, b) => {
      const firstImportant = Number(isImportant(a.competition));
      const secondImportant = Number(isImportant(b.competition));

      if (firstImportant !== secondImportant) {
        return secondImportant - firstImportant;
      }

      return Date.parse(a.kickoffTime) - Date.parse(b.kickoffTime);
    });
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function cleanupText(text) {
  return text
    .replace(/直播|视频|集锦|录像|前瞻|免费/gi, "")
    .replace(/[|｜]/g, " ")
    .trim();
}

function isImportant(competition) {
  return IMPORTANT_COMPETITIONS.some((keyword) => competition.includes(keyword));
}

function toChinaIso(value, options = {}) {
  let parts;

  if (/^\d{4},\d{1,2},\d{1,2},\d{1,2},\d{1,2},\d{1,2}$/.test(value)) {
    parts = value.split(",").map(Number);
  } else {
    const match = value.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
    );

    if (match) {
      parts = match.slice(1).map((item) => Number(item || 0));
    }
  }

  if (!parts) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  const [year, month, day, hour, minute, second = 0] = parts;
  const utcMonth = options.zeroBasedMonth ? month : month - 1;
  const utcTime = Date.UTC(year, utcMonth, day, hour - 8, minute, second);
  return new Date(utcTime).toISOString();
}

function inferStatus(value) {
  const kickoff = Date.parse(toChinaIso(value));
  const now = Date.now();

  if (now > kickoff + 120 * 60 * 1000) {
    return "完场";
  }

  if (now >= kickoff) {
    return "进行中";
  }

  return "未开始";
}

function titanStatus(state, homeScore, awayScore) {
  if (state === "0") {
    return "未开始";
  }

  if (state === "-1") {
    return "完场";
  }

  const hasScore = homeScore !== "" && awayScore !== "";
  return hasScore ? "进行中" : "待定";
}

function getChinaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getChinaYear() {
  return getChinaDate().slice(0, 4);
}

async function preserveExistingData(error) {
  try {
    const existing = await readFile(OUTPUT_FILE, "utf8");
    JSON.parse(existing);
    console.warn(`赛事抓取未更新，保留已有数据。原因：${error.message}`);
  } catch {
    const fallback = {
      date: getChinaDate(),
      timezone: TIME_ZONE,
      source: SOURCE_URLS.join(", "),
      updatedAt: new Date().toISOString(),
      matches: [],
    };

    await writeFile(OUTPUT_FILE, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
    console.warn(`赛事抓取失败，已写入空数据。原因：${error.message}`);
  }
}
