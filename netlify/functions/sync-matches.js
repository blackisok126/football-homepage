import { schedule } from "@netlify/functions";
import { jsonResponse, syncMatches } from "../../src/lib/matches/server.js";

async function runSync() {
  const payload = await syncMatches();
  return jsonResponse(payload);
}

export default schedule("*/30 0-15 * * *", runSync);
