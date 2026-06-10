import { schedule } from "@netlify/functions";
import { syncJuheWorldCupMatches } from "../../src/lib/matches/juheSyncService.js";

export default schedule("*/40 * * * *", syncJuheWorldCupMatches);
