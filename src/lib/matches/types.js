/**
 * @typedef {"not_started" | "live" | "finished" | "postponed" | "unknown"} MatchStatus
 * @typedef {"api" | "cache" | "mock" | "error"} MatchSourceStatus
 *
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} matchDate
 * @property {string} kickoffTime
 * @property {string} league
 * @property {string} homeTeam
 * @property {string} awayTeam
 * @property {MatchStatus} status
 * @property {number | null | undefined} [homeScore]
 * @property {number | null | undefined} [awayScore]
 * @property {string | null | undefined} [round]
 * @property {string} source
 * @property {MatchSourceStatus} sourceStatus
 * @property {string} updatedAt
 */

export const MATCH_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  LIVE: "live",
  FINISHED: "finished",
  POSTPONED: "postponed",
  UNKNOWN: "unknown",
});

export const SOURCE_STATUS = Object.freeze({
  API: "api",
  CACHE: "cache",
  MOCK: "mock",
  ERROR: "error",
});
