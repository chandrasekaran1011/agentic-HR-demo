#!/usr/bin/env tsx
/**
 * Rehearse: pre-flight check before the live demo.
 *
 * Verifies env, probes Azure resources, triggers a real cascade, prints
 * a pass/fail report. Run this before going on stage.
 *
 * Usage: npm run rehearse
 */
import path from "path";
import { fileURLToPath } from "url";
import { config as dotenvConfig } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load workspace .env
dotenvConfig({ path: path.join(__dirname, "..", ".env") });

const ORCHESTRATOR = process.env.ORCHESTRATOR_URL ?? "http://localhost:3001";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

function pass(label: string, detail = "") {
  console.log(`  ${GREEN}✓${RESET} ${label}${detail ? `  ${DIM}${detail}${RESET}` : ""}`);
}
function fail(label: string, detail = "") {
  console.log(`  ${RED}✗${RESET} ${label}${detail ? `  ${detail}` : ""}`);
}
function warn(label: string, detail = "") {
  console.log(`  ${YELLOW}!${RESET} ${label}${detail ? `  ${DIM}${detail}${RESET}` : ""}`);
}
function header(label: string) {
  console.log(`\n${BOLD}${label}${RESET}`);
}

let failures = 0;

async function checkOrchestrator(): Promise<boolean> {
  header("1. Orchestrator");
  try {
    const res = await fetch(`${ORCHESTRATOR}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      pass("orchestrator /health", `${ORCHESTRATOR}`);
      return true;
    }
    fail("orchestrator /health", `HTTP ${res.status}`);
    failures++;
    return false;
  } catch (err) {
    fail(
      "orchestrator unreachable",
      `${(err as Error).message} — start it with 'npm run orchestrator'`
    );
    failures++;
    return false;
  }
}

async function checkChat() {
  header("2. Azure OpenAI Chat (Responses API)");
  if (!process.env.AZURE_OPENAI_CHAT_API_KEY && !process.env.AZURE_OPENAI_API_KEY) {
    warn("AZURE_OPENAI_CHAT_API_KEY not set — chat will run in MOCK mode");
    return;
  }
  try {
    const res = await fetch(`${ORCHESTRATOR}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "say: ok" }] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok || !res.body) {
      fail("chat HTTP", `${res.status}`);
      failures++;
      return;
    }
    const text = await res.text();
    const errMatch = /"type":"error","message":"([^"]+)"/.exec(text);
    if (errMatch) {
      fail("chat error", errMatch[1] ?? "");
      failures++;
      return;
    }
    pass("chat round-trip", `deployment=${process.env.AZURE_OPENAI_CHAT_DEPLOYMENT}`);
  } catch (err) {
    fail("chat error", (err as Error).message);
    failures++;
  }
}

async function checkVoice() {
  header("3. Azure OpenAI Realtime (voice)");
  if (
    !process.env.AZURE_OPENAI_REALTIME_API_KEY &&
    !process.env.AZURE_OPENAI_API_KEY
  ) {
    warn("AZURE_OPENAI_REALTIME_API_KEY not set — voice mic will be mock");
    return;
  }
  try {
    const res = await fetch(`${ORCHESTRATOR}/voice/session`, {
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    if (data.mock) {
      warn("voice in mock mode", data.message);
      return;
    }
    if (data.error) {
      fail("voice session mint failed", String(data.error));
      failures++;
      return;
    }
    if (!data.session?.client_secret?.value) {
      fail("voice session missing ephemeral key");
      failures++;
      return;
    }
    pass("voice session minted", `webrtcUrl=${data.webrtcUrl}`);
  } catch (err) {
    fail("voice probe error", (err as Error).message);
    failures++;
  }
}

async function checkAcs() {
  header("4. Azure Communication Services (email)");
  const conn = process.env.AZURE_COMM_CONNECTION_STRING;
  const sender = process.env.AZURE_COMM_SENDER_ADDRESS;
  if (!conn || !sender) {
    warn("ACS not configured — emails log to stdout (mock)");
    return;
  }
  pass("ACS configured", `sender=${sender.replace(/[\s,]+$/, "")}`);
  console.log(`    ${DIM}(skip live send to avoid spam — see /tmp/orch.log for delivery status)${RESET}`);
}

async function checkRedis() {
  header("5. Redis & seed data");
  try {
    const { getRedis, closeRedis } = await import("../packages/portal/lib/redis");
    const r = getRedis();
    const ping = await r.ping();
    pass("redis", `PING ${ping}`);
    const candidates = await r.smembers("candidates:active");
    if (candidates.length === 0) {
      warn("no candidates in Redis", "run 'npm run reset' to seed");
    } else {
      pass(`${candidates.length} candidates seeded`, candidates.join(", "));
    }
    const roles = await r.hlen("master:roles");
    if (roles === 0) {
      warn("no master:roles", "run 'npm run reset'");
    } else {
      pass(`${roles} roles loaded into master:roles`);
    }
    await closeRedis();
  } catch (err) {
    fail("redis error", (err as Error).message);
    failures++;
  }
}

async function triggerCascade() {
  header("6. Live cascade test (Karan Shah)");
  try {
    const res = await fetch(`${ORCHESTRATOR}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        candidate: {
          id: "karan-shah",
          name: "Karan Shah",
          email: "karan.shah@acme.com",
          role: "Senior Frontend Engineer",
          team: "AI Platform",
          manager: "Sneha Roy",
          joining_date: "2026-05-12",
          current_city: "Mumbai",
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      fail("/run rejected", `HTTP ${res.status}`);
      failures++;
      return;
    }
    pass("/run accepted, watching for completion…");
    // Poll the candidate's tile state until all 12 are done or 60s elapses.
    const { getRedis, closeRedis } = await import("../packages/portal/lib/redis");
    const r = getRedis();
    const SYSTEMS = [
      "hrms", "documents", "buddy", "it", "software", "training",
      "welcome", "idcard", "payroll", "manager_notify", "seating", "parking",
    ];
    const start = Date.now();
    const TIMEOUT_MS = 60_000;
    let done = 0;
    while (Date.now() - start < TIMEOUT_MS) {
      done = 0;
      for (const s of SYSTEMS) {
        const status = await r.hget(`tile:karan-shah:${s}`, "status");
        if (status === "done") done++;
      }
      if (done >= 12) break;
      await new Promise((res) => setTimeout(res, 1000));
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (done >= 12) {
      pass(`cascade completed in ${elapsed}s`, "all 12 tiles done");
    } else {
      fail(`cascade incomplete after ${elapsed}s`, `${done}/12 tiles done`);
      failures++;
    }
    await closeRedis();
  } catch (err) {
    fail("cascade error", (err as Error).message);
    failures++;
  }
}

async function main() {
  console.log(`${BOLD}HR Onboarding Agent — rehearsal pre-flight${RESET}`);
  console.log(`${DIM}Date: ${new Date().toISOString()}${RESET}`);

  const ok = await checkOrchestrator();
  if (!ok) {
    console.log(`\n${RED}Aborting — orchestrator must be running.${RESET}`);
    console.log(`Start it with: ${BOLD}npm run orchestrator${RESET}`);
    process.exit(1);
  }
  await checkRedis();
  await checkChat();
  await checkVoice();
  await checkAcs();
  await triggerCascade();

  console.log("");
  if (failures === 0) {
    console.log(`${GREEN}${BOLD}✓ Rehearsal passed — ready for stage.${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}✗ ${failures} check(s) failed — fix before going live.${RESET}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("rehearse crashed:", err);
  process.exit(2);
});
