export interface CompanyConfig {
  name: string;
  domain: string;
  brandColor: string;
  logoUrl: string;
  officeCity: string;
  officeAddress: string;
}

export function getCompany(): CompanyConfig {
  return {
    name: process.env.COMPANY_NAME ?? "Acme Corp",
    domain: process.env.COMPANY_DOMAIN ?? "acme.com",
    brandColor: process.env.COMPANY_BRAND_COLOR ?? "#3b82f6",
    logoUrl: process.env.COMPANY_LOGO_URL ?? "",
    officeCity: process.env.COMPANY_OFFICE_CITY ?? "San Francisco",
    officeAddress: process.env.COMPANY_OFFICE_ADDRESS ?? "1455 Market Street, San Francisco CA 94103",
  };
}
