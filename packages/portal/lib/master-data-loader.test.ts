import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadMasterData, getMasterRoles, getMasterSoftwareForRole } from "./master-data-loader";
import { getRedis, closeRedis } from "./redis";

describe("master data loader", () => {
  beforeAll(async () => {
    await getRedis().flushdb();
    await loadMasterData();
  });

  afterAll(async () => {
    await closeRedis();
  });

  it("loads roles into redis", async () => {
    const roles = await getMasterRoles();
    expect(roles.length).toBeGreaterThan(0);
    const srBe = roles.find((r) => r.id === "sr_be");
    expect(srBe?.name).toBe("Senior Backend Engineer");
  });

  it("returns software ids for a role", async () => {
    const ids = await getMasterSoftwareForRole("sr_be");
    expect(ids).toContain("copilot");
    expect(ids).toContain("datadog");
  });
});
