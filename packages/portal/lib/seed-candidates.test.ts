import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadSeedCandidates, getCandidate, listCandidates, getTiles } from "./seed-candidates";
import { getRedis, closeRedis } from "./redis";

describe("seed candidates", () => {
  beforeAll(async () => {
    await getRedis().flushdb();
    await loadSeedCandidates();
  });

  afterAll(async () => {
    await closeRedis();
  });

  it("loads four candidates", async () => {
    const all = await listCandidates();
    expect(all.length).toBe(4);
  });

  it("loads priya with progress 8", async () => {
    const priya = await getCandidate("priya-sharma");
    expect(priya?.name).toBe("Priya Sharma");
    expect(priya?.progress).toBe(8);
    expect(priya?.status).toBe("in_progress");
  });

  it("populates tiles for priya", async () => {
    const tiles = await getTiles("priya-sharma");
    expect(tiles.length).toBe(12);
    const hrms = tiles.find((t) => t.system === "hrms");
    expect(hrms?.status).toBe("done");
    expect(hrms?.ticket_id).toBe("EMP-2026-0840");
  });
});
