import { jsonResponse } from "../../src/lib/matches/server.js";

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";

export default async function searchFootballLeagues(request) {
  const url = new URL(request.url);
  const search = String(url.searchParams.get("search") || "").trim();
  const apiKey = process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY;

  if (!search || !apiKey) {
    return jsonResponse({
      success: false,
      reason: "missing_config",
      leagues: [],
    });
  }

  try {
    const baseUrl = String(process.env.FOOTBALL_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    const requestUrl = new URL(`${baseUrl}/leagues`);
    requestUrl.searchParams.set("search", search);

    const response = await fetch(requestUrl, {
      headers: {
        Accept: "application/json",
        "x-apisports-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`API-Football leagues request failed: ${response.status}`);
    }

    const payload = await response.json();
    const leagues = (Array.isArray(payload.response) ? payload.response : []).map((entry) => ({
      id: entry.league?.id ?? null,
      name: entry.league?.name || "",
      country: entry.country?.name || "",
      type: entry.league?.type || "",
      seasons: (entry.seasons || []).map((season) => season.year),
    }));

    return jsonResponse({
      success: true,
      leagues,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      reason: "request_failed",
      leagues: [],
      message: error.message || "League search failed",
    });
  }
}
