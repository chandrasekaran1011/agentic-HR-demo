import { describe, it, expect, beforeEach } from "vitest";
import { getCompany } from "./company";

describe("getCompany", () => {
  beforeEach(() => {
    process.env.COMPANY_NAME = "Acme Corp";
    process.env.COMPANY_DOMAIN = "acme.com";
    process.env.COMPANY_BRAND_COLOR = "#3b82f6";
    process.env.COMPANY_LOGO_URL = "";
    process.env.COMPANY_OFFICE_CITY = "Chennai";
    process.env.COMPANY_OFFICE_ADDRESS = "DLF IT Park";
  });

  it("reads all six fields from env", () => {
    const c = getCompany();
    expect(c.name).toBe("Acme Corp");
    expect(c.domain).toBe("acme.com");
    expect(c.brandColor).toBe("#3b82f6");
    expect(c.officeCity).toBe("Chennai");
    expect(c.officeAddress).toBe("DLF IT Park");
  });

  it("falls back to sensible defaults when env missing", () => {
    delete process.env.COMPANY_NAME;
    const c = getCompany();
    expect(c.name).toBe("Acme Corp");
  });
});
