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
      id: "mock-worldcup-live",
      league: "世界杯",
      kickoffTime: createRelativeKickoff(-45),
      homeTeam: "加拿大",
      awayTeam: "墨西哥",
      status: MATCH_STATUS.LIVE,
      homeScore: 1,
      awayScore: 0,
      round: "小组赛",
    }),
    createMatch({
      id: "mock-worldcup-finished",
      league: "世界杯",
      kickoffTime: createRelativeKickoff(-210),
      homeTeam: "美国",
      awayTeam: "日本",
      status: MATCH_STATUS.FINISHED,
      homeScore: 2,
      awayScore: 2,
      round: "小组赛",
    }),
    createMatch({
      id: "mock-worldcup-upcoming-1",
      league: "世界杯",
      kickoffTime: createRelativeKickoff(120),
      homeTeam: "法国",
      awayTeam: "葡萄牙",
      status: MATCH_STATUS.NOT_STARTED,
      round: "小组赛",
    }),
    createMatch({
      id: "mock-worldcup-upcoming-2",
      league: "世界杯",
      kickoffTime: createRelativeKickoff(360),
      homeTeam: "阿根廷",
      awayTeam: "德国",
      status: MATCH_STATUS.NOT_STARTED,
      round: "小组赛",
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
