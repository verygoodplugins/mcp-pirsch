export type DateRangeRequirement = 'forbidden' | 'optional' | 'required';

export interface StatisticsMetricDefinition {
  endpoint: string;
  dateRange: DateRangeRequirement;
  requires?: readonly ('event' | 'tags' | 'visitorId' | 'sessionId')[];
}

export const statisticsMetrics = {
  overview: { endpoint: '/statistics/overview', dateRange: 'forbidden' },
  total: { endpoint: '/statistics/total', dateRange: 'required' },
  visitors: { endpoint: '/statistics/visitor', dateRange: 'required' },
  hostnames: { endpoint: '/statistics/hostname', dateRange: 'required' },
  pages: { endpoint: '/statistics/page', dateRange: 'required' },
  entry_pages: { endpoint: '/statistics/page/entry', dateRange: 'required' },
  exit_pages: { endpoint: '/statistics/page/exit', dateRange: 'required' },
  session_duration: { endpoint: '/statistics/duration/session', dateRange: 'required' },
  page_duration: { endpoint: '/statistics/duration/page', dateRange: 'required' },
  goals: { endpoint: '/statistics/goals', dateRange: 'required' },
  events: { endpoint: '/statistics/events', dateRange: 'required' },
  event_meta: { endpoint: '/statistics/event/meta', dateRange: 'required', requires: ['event'] },
  event_list: { endpoint: '/statistics/event/list', dateRange: 'required' },
  event_pages: { endpoint: '/statistics/event/page', dateRange: 'required', requires: ['event'] },
  growth: { endpoint: '/statistics/growth', dateRange: 'required' },
  active: { endpoint: '/statistics/active', dateRange: 'optional' },
  hours: { endpoint: '/statistics/hours', dateRange: 'required' },
  minutes: { endpoint: '/statistics/minutes', dateRange: 'required' },
  weekdays: { endpoint: '/statistics/weekdays', dateRange: 'required' },
  languages: { endpoint: '/statistics/language', dateRange: 'required' },
  referrers: { endpoint: '/statistics/referrer', dateRange: 'required' },
  channels: { endpoint: '/statistics/channel', dateRange: 'required' },
  operating_systems: { endpoint: '/statistics/os', dateRange: 'required' },
  browsers: { endpoint: '/statistics/browser', dateRange: 'required' },
  browser_versions: { endpoint: '/statistics/browser/version', dateRange: 'required' },
  countries: { endpoint: '/statistics/country', dateRange: 'required' },
  regions: { endpoint: '/statistics/region', dateRange: 'required' },
  cities: { endpoint: '/statistics/city', dateRange: 'required' },
  platforms: { endpoint: '/statistics/platform', dateRange: 'required' },
  screen_classes: { endpoint: '/statistics/screen', dateRange: 'required' },
  utm_sources: { endpoint: '/statistics/utm/source', dateRange: 'required' },
  utm_mediums: { endpoint: '/statistics/utm/medium', dateRange: 'required' },
  utm_campaigns: { endpoint: '/statistics/utm/campaign', dateRange: 'required' },
  utm_contents: { endpoint: '/statistics/utm/content', dateRange: 'required' },
  utm_terms: { endpoint: '/statistics/utm/term', dateRange: 'required' },
  tag_keys: { endpoint: '/statistics/tags', dateRange: 'required' },
  tag_details: { endpoint: '/statistics/tag/details', dateRange: 'required', requires: ['tags'] },
  keywords: { endpoint: '/statistics/keywords', dateRange: 'required' },
  funnels: { endpoint: '/statistics/funnel', dateRange: 'required' },
  sessions: { endpoint: '/statistics/session/list', dateRange: 'required' },
  session_details: {
    endpoint: '/statistics/session/details',
    dateRange: 'optional',
    requires: ['visitorId', 'sessionId'],
  },
} as const satisfies Record<string, StatisticsMetricDefinition>;

export const filterOptionMetrics = {
  hostname: '/options/hostname',
  page: '/options/page',
  referrer: '/options/referrer',
  referrerName: '/options/referrer/name',
  channel: '/options/channel',
  event: '/options/event',
  country: '/options/country',
  region: '/options/region',
  city: '/options/city',
  language: '/options/language',
  browser: '/options/browser',
  operatingSystem: '/options/os',
  metadataKey: '/options/metadata/keys',
  metadata: '/options/metadata',
  utmSource: '/options/utm/source',
  utmMedium: '/options/utm/medium',
  utmCampaign: '/options/utm/campaign',
  utmContent: '/options/utm/content',
  utmTerm: '/options/utm/term',
  tag: '/options/tag',
  tagValue: '/options/tag/value',
} as const;

export type StatisticsMetric = keyof typeof statisticsMetrics;
export type FilterOptionMetric = keyof typeof filterOptionMetrics;
