import type { FilterInput, PirschFilter } from './types.js';

export function buildFilterParams(filter: FilterInput, domainId: string, defaults?: { tz?: string }): URLSearchParams {
  const params = new URLSearchParams();

  // Always include domain id
  params.set('id', domainId);

  const set = (key: keyof FilterInput, val?: string | number | boolean | null) => {
    if (val === undefined || val === null || val === '') return;
    params.set(String(key), String(val));
  };

  // Core date/time filters
  set('from', filter.from);
  set('to', filter.to);
  set('from_time', filter.from_time);
  set('to_time', filter.to_time);
  set('tz', filter.tz || defaults?.tz);
  if (typeof filter.start === 'number') params.set('start', String(filter.start));
  set('scale', filter.scale);

  // Dimensions
  set('hostname', filter.hostname);
  set('path', filter.path);
  set('entry_path', filter.entry_path);
  set('exit_path', filter.exit_path);
  set('pattern', filter.pattern);
  set('event', filter.event);
  set('event_meta_key', filter.event_meta_key);
  set('language', filter.language);
  set('country', filter.country);
  set('city', filter.city);
  set('referrer', filter.referrer);
  set('referrer_name', filter.referrer_name);
  set('channel', filter.channel);
  set('os', filter.os);
  set('browser', filter.browser);
  set('platform', filter.platform);
  set('screen_class', filter.screen_class);

  // UTM
  set('utm_source', filter.utm_source);
  set('utm_medium', filter.utm_medium);
  set('utm_campaign', filter.utm_campaign);
  set('utm_content', filter.utm_content);
  set('utm_term', filter.utm_term);

  // Custom metrics
  set('custom_metric_type', filter.custom_metric_type);
  set('custom_metric_key', filter.custom_metric_key);

  // Tags
  set('tag', filter.tag);

  // Pagination and sorting
  if (typeof filter.offset === 'number') params.set('offset', String(filter.offset));
  if (typeof filter.limit === 'number') params.set('limit', String(filter.limit));
  if (typeof filter.include_avg_time_on_page === 'boolean') params.set('include_avg_time_on_page', String(filter.include_avg_time_on_page));
  if (typeof filter.include_title === 'boolean') params.set('include_title', String(filter.include_title));
  set('sort', filter.sort);
  set('direction', filter.direction);
  set('search', filter.search);
  set('keyword', filter.keyword);

  // Session filters
  set('visitor_id', filter.visitor_id);
  set('session_id', filter.session_id);

  return params;
}

const v1FilterParameterNames = {
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
const stringFilterFields = [
  'from', 'to', 'fromTime', 'toTime', 'timezone', 'hostname', 'path', 'entryPath', 'exitPath', 'pattern', 'event',
  'eventMetaKey', 'language', 'country', 'region', 'city', 'referrer', 'referrerName', 'channel', 'operatingSystem',
  'browser', 'screenClass', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'customMetricKey',
  'tags', 'sort', 'search', 'keyword', 'visitorId', 'sessionId',
] as const satisfies ReadonlyArray<keyof PirschFilter>;

const enumFilterValues = {
  scale: ['day', 'week', 'month', 'year'],
  platform: ['desktop', 'mobile', 'unknown'],
  customMetricType: ['integer', 'float'],
  direction: ['asc', 'desc'],
} as const satisfies Partial<Record<keyof PirschFilter, readonly string[]>>;

function isValidIsoDate(value: string): boolean {
  if (!isoDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateV1Filter(filter: PirschFilter): void {
  for (const name of stringFilterFields) {
    const value = filter[name];
    if (value !== undefined && typeof value !== 'string') throw new Error(`${name} must be a string.`);
  }
  for (const [name, allowedValues] of Object.entries(enumFilterValues) as Array<[keyof typeof enumFilterValues, readonly string[]]>) {
    const value = filter[name];
    if (value !== undefined && (typeof value !== 'string' || !allowedValues.includes(value))) {
      throw new Error(`${name} must be one of: ${allowedValues.join(', ')}.`);
    }
  }
  for (const name of ['includeAverageTimeOnPage', 'includeTitle'] as const) {
    const value = filter[name];
    if (value !== undefined && typeof value !== 'boolean') throw new Error(`${name} must be a boolean.`);
  }
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

export function buildV1FilterParams(filter: PirschFilter, domainId: string, defaultTimezone?: string): URLSearchParams {
  const params = new URLSearchParams({ id: domainId });
  for (const [key, parameter] of Object.entries(v1FilterParameterNames) as Array<[keyof PirschFilter, string]>) {
    const value = filter[key];
    if (value !== undefined && value !== null && value !== '') params.set(parameter, String(value));
  }
  if (!params.has('tz') && defaultTimezone) params.set('tz', defaultTimezone);
  return params;
}
