export const WORLD_CUP_DEFAULTS = Object.freeze({
  LEAGUE_ID: 1,
  SEASON: 2026,
  TIMEZONE: "Asia/Shanghai",
  SYNC_DAYS_BEFORE: 7,
  SYNC_DAYS_AFTER: 3,
});

export function getWorldCupConfig(env = process.env) {
  return {
    leagueId: readInteger(env.API_FOOTBALL_WORLD_CUP_LEAGUE_ID, WORLD_CUP_DEFAULTS.LEAGUE_ID),
    season: readInteger(env.API_FOOTBALL_WORLD_CUP_SEASON, WORLD_CUP_DEFAULTS.SEASON),
    timezone: env.API_FOOTBALL_TIMEZONE || WORLD_CUP_DEFAULTS.TIMEZONE,
    syncDaysBefore: readInteger(
      env.WORLD_CUP_SYNC_DAYS_BEFORE,
      WORLD_CUP_DEFAULTS.SYNC_DAYS_BEFORE,
    ),
    syncDaysAfter: readInteger(
      env.WORLD_CUP_SYNC_DAYS_AFTER,
      WORLD_CUP_DEFAULTS.SYNC_DAYS_AFTER,
    ),
  };
}

function readInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}
