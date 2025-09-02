export interface PirschTokenResponse {
  access_token: string;
  expires_at: string; // ISO UTC
}

export interface Domain {
  id: string;
  hostname: string;
  subdomain: string | null;
  custom_domain?: string | null;
  display_name?: string | null;
  timezone?: string | null;
}

export interface FilterInput {
  id?: string; // domain id (will be injected if omitted)
  from?: string;
  to?: string;
  from_time?: string;
  to_time?: string;
  tz?: string;
  start?: number;
  scale?: 'day' | 'week' | 'month' | 'year';
  hostname?: string;
  path?: string;
  entry_path?: string;
  exit_path?: string;
  pattern?: string;
  event?: string;
  event_meta_key?: string;
  language?: string;
  country?: string;
  city?: string;
  referrer?: string;
  referrer_name?: string;
  channel?: string;
  os?: string;
  browser?: string;
  platform?: 'desktop' | 'mobile' | 'unknown';
  screen_class?: 'XXL' | 'XL' | 'L' | 'M' | 'S' | string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  custom_metric_type?: 'integer' | 'float';
  custom_metric_key?: string;
  tag?: string;
  offset?: number;
  limit?: number;
  include_avg_time_on_page?: boolean;
  include_title?: boolean;
  sort?: string; // visitors, views, etc.
  direction?: 'asc' | 'desc';
  search?: string;
  visitor_id?: string;
  session_id?: string;
}

export interface VisitorsPoint {
  day?: string | null;
  week?: string | null;
  month?: string | null;
  year?: string | null;
  visitors: number;
  views: number;
  sessions: number;
  bounces: number;
  bounce_rate: number;
  cr: number;
}

