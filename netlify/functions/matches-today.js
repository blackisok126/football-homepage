import { buildMatchesTodayPayload, jsonResponse } from "../../src/lib/matches/server.js";

export default async function matchesToday() {
  const payload = await buildMatchesTodayPayload();
  return jsonResponse(payload);
}
