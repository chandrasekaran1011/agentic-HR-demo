import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.MASTER_DATA_DIR) {
  process.env.MASTER_DATA_DIR = path.join(__dirname, "..", "master-data");
}
if (!process.env.SEED_DATA_DIR) {
  process.env.SEED_DATA_DIR = path.join(__dirname, "..", "seed-data");
}

import { loadMasterData } from "../packages/portal/lib/master-data-loader";
import { loadSeedCandidates } from "../packages/portal/lib/seed-candidates";
import { closeRedis } from "../packages/portal/lib/redis";

async function main() {
  console.log("Loading master data...");
  await loadMasterData();
  console.log("Loading seed candidates...");
  await loadSeedCandidates();
  console.log("Seed complete.");
  await closeRedis();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
