import type { PirschFilter } from './types.js';

const filterParameterNames = {
  from: 'from', to: 'to', fromTime: 'from_time', toTime: 'to_time', timezone: 'tz', start: 'start', scale: 'scale',
  hostname: 'hostname', path: 'path', entryPath: 'entry_path', exitPath: 'exit_path', pattern: 'pattern', event: 'event',
  eventMetaKey: 'event_meta_key', language: 'language', country: 'country', region: 'region', city: 'city',
  referrer: 'referrer', referrerName: 'referrer_name', channel: 'channel', operatingSystem: 'os', browser: 'browser',
  platform: 'platform', screenClass: 'screen_class', utmSource: 'utm_source', utmMedium: 'utm_medium',
  utmCampaign: 'utm_campaign', utmContent: 'utm_content', utmTerm: 'utm_term', customMetricType: 'custom_metric_type',
  customMetricKey: 'custom_metric_key', tags: 'tag', offset: 'offset', limit: 'limit',
  includeAverageTimeOnPage: 'include_avg_time_on_page', includeTitle: 'include_title', sort: 'sort', direction: 'direction',
  search: 'search', keyword: 'keyword', visitorId: 'visitor_id', sessionId: 'session_id',
} as const satisfies Record<keyof PirschFilter, string>;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isValidIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateV1Filter(filter: PirschFilter): void {
  if (filter.start !== undefined && (!Number.isInteger(filter.start) || filter.start < 0 || filter.start > 3_600)) {
    throw new Error('start must be an integer from 0 to 3600.');
  }
  if (filter.offset !== undefined && (!Number.isInteger(filter.offset) || filter.offset < 0)) {
    throw new Error('offset must be a non-negative integer.');
  }
  if (filter.limit !== undefined && (!Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 100)) {
    throw new Error('limit must be an integer from 1 to 100.');
  }
  for (const [name, value] of [['from', filter.from], ['to', filter.to]]) {
    if (value !== undefined && !isValidIsoDate(value)) throw new Error(`${name} must be an ISO date.`);
  }
  for (const [name, value] of [['fromTime', filter.fromTime], ['toTime', filter.toTime]]) {
    if (value !== undefined && !clockPattern.test(value)) throw new Error(`${name} must be a 24-hour HH:MM time.`);
  }
  if (filter.from && filter.to && filter.from > filter.to) {
    throw new Error('from must be on or before to.');
  }
}

export function buildFilterParams(filter: PirschFilter, domainId: string, defaultTimezone?: string): URLSearchParams {
  const params = new URLSearchParams({ id: domainId });
  for (const [key, parameter] of Object.entries(filterParameterNames) as Array<[keyof PirschFilter, string]>) {
    const value = filter[key];
    if (value !== undefined && value !== null && value !== '') params.set(parameter, String(value));
  }
  if (!params.has('tz') && defaultTimezone) params.set('tz', defaultTimezone);
  return params;
}
