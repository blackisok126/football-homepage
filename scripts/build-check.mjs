import { accessSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";

const filesToCheck = [
  "main.js",
  "scripts/prepare-qr-assets.mjs",
  "scripts/build-check.mjs",
  "src/lib/matches/types.js",
  "src/lib/matches/matchAdapter.js",
  "src/lib/matches/worldCupConfig.js",
  "src/lib/matches/mockMatches.js",
  "src/lib/matches/getTodayMatches.js",
  "src/lib/matches/providers/mockProvider.js",
  "src/lib/matches/providers/apiFootballProvider.js",
  "src/lib/matches/providers/friendliesProvider.js",
  "src/lib/matches/providers/worldCupProvider.js",
  "src/lib/matches/server.js",
  "src/lib/supabase.js",
  "netlify/functions/matches-today.js",
  "netlify/functions/friendly-matches.js",
  "netlify/functions/homepage-matches.js",
  "netlify/functions/search-football-leagues.js",
  "netlify/functions/sync-friendly-matches.js",
  "netlify/functions/world-cup-matches.js",
  "netlify/functions/sync-world-cup-matches.js",
  "netlify/functions/sync-matches.js"
];

for (const file of filesToCheck) {
  accessSync(file, constants.R_OK);

  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log("Build check passed.");
