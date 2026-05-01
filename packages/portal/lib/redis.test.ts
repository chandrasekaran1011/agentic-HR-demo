import { describe, it, expect, afterAll } from "vitest";
import { getRedis, closeRedis } from "./redis";

describe("redis client", () => {
  afterAll(async () => {
    await closeRedis();
  });

  it("returns a singleton client and supports basic ops", async () => {
    const r1 = getRedis();
    const r2 = getRedis();
    expect(r1).toBe(r2);

    await r1.set("test:hello", "world");
    const got = await r1.get("test:hello");
    expect(got).toBe("world");
    await r1.del("test:hello");
  });
});
