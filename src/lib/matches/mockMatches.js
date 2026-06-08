import { MATCH_STATUS, SOURCE_STATUS } from "./types.js";
import { formatMatchDate } from "./matchAdapter.js";

function createRelativeKickoff(minutesFromNow) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

function createMatch({
  id,
  league,
  kickoffTime,
  homeTeam,
  awayTeam,
  status,
  homeScore = null,
  awayScore = null,
  round = null,
}) {
  const updatedAt = new Date().toISOString();

  return {
    id,
    matchDate: formatMatchDate(kickoffTime),
    kickoffTime,
    league,
    homeTeam,
    awayTeam,
    status,
    homeScore,
    awayScore,
    round,
    source: "mock-provider",
    sourceStatus: SOURCE_STATUS.MOCK,
    updatedAt,
  };
}

export function createMockMatches() {
  return [
    createMatch({
      id: "mock-csl-live",
      league: "中超",
      kickoffTime: createRelativeKickoff(-45),
      homeTeam: "上海申花",
      awayTeam: "成都蓉城",
      status: MATCH_STATUS.LIVE,
      homeScore: 1,
      awayScore: 0,
      round: "第14轮",
    }),
    createMatch({
      id: "mock-jleague-finished",
      league: "日职联",
      kickoffTime: createRelativeKickoff(-210),
      homeTeam: "横滨水手",
      awayTeam: "川崎前锋",
      status: MATCH_STATUS.FINISHED,
      homeScore: 2,
      awayScore: 2,
      round: "第18轮",
    }),
    createMatch({
      id: "mock-friendly-upcoming",
      league: "国际友谊赛",
      kickoffTime: createRelativeKickoff(120),
      homeTeam: "法国",
      awayTeam: "葡萄牙",
      status: MATCH_STATUS.NOT_STARTED,
      round: "热身赛",
    }),
    createMatch({
      id: "mock-epl-upcoming",
      league: "英超",
      kickoffTime: createRelativeKickoff(360),
      homeTeam: "阿森纳",
      awayTeam: "纽卡斯尔联",
      status: MATCH_STATUS.NOT_STARTED,
      round: "第1轮",
    }),
  ];
}

export function createMockMatchesResponse(
  message = "当前为演示数据，接入正式数据源后自动更新。",
) {
  const matches = createMockMatches();

  return {
    success: true,
    sourceStatus: SOURCE_STATUS.MOCK,
    updatedAt: matches[0]?.updatedAt || new Date().toISOString(),
    matches,
    message,
  };
}
