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

  it("loads eight candidates", async () => {
    const all = await listCandidates();
    expect(all.length).toBe(8);
  });

  it("loads jessica with progress 8", async () => {
    const jessica = await getCandidate("jessica-cohen");
    expect(jessica?.name).toBe("Jessica Cohen");
    expect(jessica?.progress).toBe(8);
    expect(jessica?.status).toBe("in_progress");
  });

  it("populates tiles for jessica", async () => {
    const tiles = await getTiles("jessica-cohen");
    expect(tiles.length).toBe(12);
    const hrms = tiles.find((t) => t.system === "hrms");
    expect(hrms?.status).toBe("done");
    expect(hrms?.ticket_id).toBe("EMP-2026-0840");
  });
});
