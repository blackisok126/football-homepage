import { accessSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";

const filesToCheck = [
  "main.js",
  "scripts/fetch-matches.mjs",
  "scripts/prepare-qr-assets.mjs",
  "scripts/build-check.mjs",
  "src/lib/matches/types.js",
  "src/lib/matches/matchAdapter.js",
  "src/lib/matches/mockMatches.js",
  "src/lib/matches/getTodayMatches.js",
  "src/lib/matches/providers/localChineseProvider.js",
  "src/lib/matches/providers/mockProvider.js",
  "src/lib/matches/providers/sportteryProvider.js",
  "src/lib/matches/providers/apiFootballProvider.js",
  "src/lib/matches/server.js",
  "src/lib/supabase.js",
  "netlify/functions/matches-today.js",
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
