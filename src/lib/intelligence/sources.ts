/**
 * Public data source adapters. Each source is a separate module behind this
 * interface so integrations stay independent. None is implemented yet; each is
 * listed with its status so the research pipeline records it as `skipped`
 * rather than pretending to have checked it.
 *
 * Rules for implementers (SECURITY.md -> Public research):
 *  - use official APIs or bulk downloads; respect terms, auth and rate limits
 *  - never scrape restricted platforms or bypass authentication
 *  - results are `researched` facts with source URLs, pending human verification
 */
export interface PublicSourceMatch {
  title: string;
  url: string;
  identifier?: string;
  date?: string;
  amountUsd?: number;
  raw: Record<string, unknown>;
}

export interface PublicSourceAdapter {
  key: string;
  name: string;
  status: "not_implemented" | "available";
  officialAccess: string;
  search?: (q: { companyName: string; domain?: string | null }) => Promise<PublicSourceMatch[]>;
}

export const PUBLIC_SOURCES: PublicSourceAdapter[] = [
  { key: "sbir_awards", name: "SBIR/STTR award data", status: "not_implemented", officialAccess: "SBIR.gov awards API / data downloads" },
  { key: "usaspending", name: "USAspending.gov", status: "not_implemented", officialAccess: "api.usaspending.gov (public API)" },
  { key: "sam_gov", name: "SAM.gov entity data", status: "not_implemented", officialAccess: "SAM.gov Entity API (API key required)" },
  { key: "marketplace_listings", name: "Publicly accessible marketplace listings", status: "not_implemented", officialAccess: "Public listing pages only, per each marketplace's terms" },
  { key: "sec_form_d", name: "SEC Form D filings", status: "not_implemented", officialAccess: "SEC EDGAR full-text search / submissions API (declared User-Agent)" },
  { key: "university_announcements", name: "University commercialization announcements", status: "not_implemented", officialAccess: "Public news pages and RSS feeds" },
  { key: "company_announcements", name: "Public company announcements", status: "not_implemented", officialAccess: "Company newsroom pages and RSS feeds" },
];
