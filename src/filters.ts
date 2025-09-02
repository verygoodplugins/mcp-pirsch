import type { FilterInput } from './types.js';

export function buildFilterParams(filter: FilterInput, domainId: string, defaults?: { tz?: string }): URLSearchParams {
  const params = new URLSearchParams();

  // Always include domain id
  params.set('id', domainId);

  const set = (key: keyof FilterInput, val?: any) => {
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

  // Session filters
  set('visitor_id', filter.visitor_id);
  set('session_id', filter.session_id);

  return params;
}

