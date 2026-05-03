import { describe, it, expect, beforeEach } from "vitest";
import { getCompany } from "./company";

describe("getCompany", () => {
  beforeEach(() => {
    process.env.COMPANY_NAME = "Acme Corp";
    process.env.COMPANY_DOMAIN = "acme.com";
    process.env.COMPANY_BRAND_COLOR = "#3b82f6";
    process.env.COMPANY_LOGO_URL = "";
    process.env.COMPANY_OFFICE_CITY = "San Francisco";
    process.env.COMPANY_OFFICE_ADDRESS = "1455 Market Street";
  });

  it("reads all six fields from env", () => {
    const c = getCompany();
    expect(c.name).toBe("Acme Corp");
    expect(c.domain).toBe("acme.com");
    expect(c.brandColor).toBe("#3b82f6");
    expect(c.officeCity).toBe("San Francisco");
    expect(c.officeAddress).toBe("1455 Market Street");
  });

  it("falls back to sensible defaults when env missing", () => {
    delete process.env.COMPANY_NAME;
    const c = getCompany();
    expect(c.name).toBe("Acme Corp");
  });
});
