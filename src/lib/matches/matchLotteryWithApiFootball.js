import aliases from "../../../data/football-cn-aliases.json" with { type: "json" };

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function matchLotteryWithApiFootball(lotteryMatches = [], apiMatches = []) {
  return lotteryMatches.map((lotteryMatch) => {
    const apiMatch = findApiMatch(lotteryMatch, apiMatches);

    if (!apiMatch) {
      return lotteryMatch;
    }

    return {
      ...lotteryMatch,
      apiFootball: {
        id: apiMatch.id,
        league: apiMatch.league,
        homeTeam: apiMatch.homeTeam,
        awayTeam: apiMatch.awayTeam,
      },
      homeScore: lotteryMatch.homeScore ?? apiMatch.homeScore,
      awayScore: lotteryMatch.awayScore ?? apiMatch.awayScore,
      status: lotteryMatch.status || apiMatch.status,
    };
  });
}

function findApiMatch(lotteryMatch, apiMatches) {
  const kickoff = Date.parse(lotteryMatch.kickoffTime || "");

  return apiMatches.find((apiMatch) => {
    const apiKickoff = Date.parse(apiMatch.kickoffTime || "");

    if (Number.isNaN(kickoff) || Number.isNaN(apiKickoff)) {
      return false;
    }

    if (Math.abs(kickoff - apiKickoff) > TWO_HOURS_MS) {
      return false;
    }

    return (
      isNameMatch(lotteryMatch.homeTeamCn || lotteryMatch.homeTeam, apiMatch.homeTeam) &&
      isNameMatch(lotteryMatch.awayTeamCn || lotteryMatch.awayTeam, apiMatch.awayTeam)
    );
  });
}

function isNameMatch(chineseName = "", apiName = "") {
  const mapped = aliases.teams?.[apiName] || apiName;
  const left = normalizeName(chineseName);
  const right = normalizeName(mapped);

  return Boolean(left && right && (left.includes(right) || right.includes(left)));
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）.\-]/g, "");
}
