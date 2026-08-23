export interface PirschCredentials {
  clientId?: string;
  clientSecret?: string;
}

export interface SafeDomain {
  id: string;
  hostname?: string;
  displayName?: string;
  timezone?: string;
}

export interface PirschFilter {
  from?: string;
  to?: string;
  fromTime?: string;
  toTime?: string;
  timezone?: string;
  start?: number;
  scale?: 'day' | 'week' | 'month' | 'year';
  hostname?: string;
  path?: string;
  entryPath?: string;
  exitPath?: string;
  pattern?: string;
  event?: string;
  eventMetaKey?: string;
  language?: string;
  country?: string;
  region?: string;
  city?: string;
  referrer?: string;
  referrerName?: string;
  channel?: string;
  operatingSystem?: string;
  browser?: string;
  platform?: 'desktop' | 'mobile' | 'unknown';
  screenClass?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  customMetricType?: 'integer' | 'float';
  customMetricKey?: string;
  tags?: string;
  offset?: number;
  limit?: number;
  includeAverageTimeOnPage?: boolean;
  includeTitle?: boolean;
  sort?: string;
  direction?: 'asc' | 'desc';
  search?: string;
  keyword?: string;
  visitorId?: string;
  sessionId?: string;
}

export interface StatisticsTotals {
  visitors?: number;
  views?: number;
  sessions?: number;
  bounces?: number;
  bounce_rate?: number;
  cr?: number;
  [key: string]: unknown;
}

export interface VisitorsPoint {
  day?: string | null;
  week?: string | null;
  month?: string | null;
  year?: string | null;
  visitors?: number;
  views?: number;
  sessions?: number;
  bounces?: number;
  bounce_rate?: number;
  cr?: number;
  [key: string]: unknown;
}

/** Credentials for the v1 read client. Kept separate from legacy tool inputs. */
export interface PirschCredentials {
  clientId?: string;
  clientSecret?: string;
}

/** The intentionally small, account-safe domain view exposed by MCP. */
export interface SafeDomain {
  id: string;
  hostname?: string;
  displayName?: string;
  timezone?: string;
}

/** Camel-cased v1 filters used by the new client and future MCP v2 tools. */
export interface PirschFilter {
  from?: string;
  to?: string;
  fromTime?: string;
  toTime?: string;
  timezone?: string;
  start?: number;
  scale?: 'day' | 'week' | 'month' | 'year';
  hostname?: string;
  path?: string;
  entryPath?: string;
  exitPath?: string;
  pattern?: string;
  event?: string;
  eventMetaKey?: string;
  language?: string;
  country?: string;
  region?: string;
  city?: string;
  referrer?: string;
  referrerName?: string;
  channel?: string;
  operatingSystem?: string;
  browser?: string;
  platform?: 'desktop' | 'mobile' | 'unknown';
  screenClass?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  customMetricType?: 'integer' | 'float';
  customMetricKey?: string;
  tags?: string;
  offset?: number;
  limit?: number;
  includeAverageTimeOnPage?: boolean;
  includeTitle?: boolean;
  sort?: string;
  direction?: 'asc' | 'desc';
  search?: string;
  keyword?: string;
  visitorId?: string;
  sessionId?: string;
}
