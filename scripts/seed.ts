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
import { setEmailOverride, getEmailOverride } from "../packages/portal/lib/demo-settings";
import { closeRedis } from "../packages/portal/lib/redis";

// Demo safety: every cascade after a fresh seed routes mail here unless an
// admin clears it via /admin/settings. Override at seed time with
// DEMO_EMAIL_OVERRIDE env to set a different default.
const DEFAULT_EMAIL_OVERRIDE =
  process.env.DEMO_EMAIL_OVERRIDE ?? "chandrasekaran3991@gmail.com";

async function main() {
  console.log("Loading master data...");
  await loadMasterData();
  console.log("Loading seed candidates...");
  await loadSeedCandidates();

  // Only set the override if the admin hasn't already changed it.
  const existing = await getEmailOverride();
  if (!existing) {
    await setEmailOverride(DEFAULT_EMAIL_OVERRIDE);
    console.log(`Email safety override set to: ${DEFAULT_EMAIL_OVERRIDE}`);
  } else {
    console.log(`Email safety override already set: ${existing} (preserved)`);
  }

  console.log("Seed complete.");
  await closeRedis();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
