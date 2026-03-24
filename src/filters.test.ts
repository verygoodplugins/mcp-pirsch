import { describe, it, expect } from 'vitest';
import { buildFilterParams } from './filters.js';

describe('buildFilterParams', () => {
  const domainId = 'test-domain-123';

  it('should always include domain id', () => {
    const params = buildFilterParams({}, domainId);
    expect(params.get('id')).toBe(domainId);
  });

  it('should set date range filters', () => {
    const params = buildFilterParams(
      {
        from: '2024-01-01',
        to: '2024-01-31',
        from_time: '09:00',
        to_time: '17:00',
      },
      domainId
    );

    expect(params.get('from')).toBe('2024-01-01');
    expect(params.get('to')).toBe('2024-01-31');
    expect(params.get('from_time')).toBe('09:00');
    expect(params.get('to_time')).toBe('17:00');
  });

  it('should set timezone from filter or defaults', () => {
    // From filter
    let params = buildFilterParams({ tz: 'America/New_York' }, domainId);
    expect(params.get('tz')).toBe('America/New_York');

    // From defaults
    params = buildFilterParams({}, domainId, { tz: 'Europe/Berlin' });
    expect(params.get('tz')).toBe('Europe/Berlin');

    // Filter takes precedence over defaults
    params = buildFilterParams({ tz: 'UTC' }, domainId, { tz: 'Europe/Berlin' });
    expect(params.get('tz')).toBe('UTC');
  });

  it('should set scale parameter', () => {
    const params = buildFilterParams({ scale: 'week' }, domainId);
    expect(params.get('scale')).toBe('week');
  });

  it('should set dimension filters', () => {
    const params = buildFilterParams(
      {
        hostname: 'example.com',
        path: '/blog',
        entry_path: '/landing',
        exit_path: '/checkout',
        pattern: '*.pdf',
        event: 'click',
        event_meta_key: 'button_id',
      },
      domainId
    );

    expect(params.get('hostname')).toBe('example.com');
    expect(params.get('path')).toBe('/blog');
    expect(params.get('entry_path')).toBe('/landing');
    expect(params.get('exit_path')).toBe('/checkout');
    expect(params.get('pattern')).toBe('*.pdf');
    expect(params.get('event')).toBe('click');
    expect(params.get('event_meta_key')).toBe('button_id');
  });

  it('should set location filters', () => {
    const params = buildFilterParams(
      {
        language: 'en',
        country: 'US',
        city: 'New York',
      },
      domainId
    );

    expect(params.get('language')).toBe('en');
    expect(params.get('country')).toBe('US');
    expect(params.get('city')).toBe('New York');
  });

  it('should set traffic source filters', () => {
    const params = buildFilterParams(
      {
        referrer: 'google.com',
        referrer_name: 'Google',
        channel: 'organic',
      },
      domainId
    );

    expect(params.get('referrer')).toBe('google.com');
    expect(params.get('referrer_name')).toBe('Google');
    expect(params.get('channel')).toBe('organic');
  });

  it('should set device/browser filters', () => {
    const params = buildFilterParams(
      {
        os: 'Windows',
        browser: 'Chrome',
        platform: 'desktop',
        screen_class: 'XL',
      },
      domainId
    );

    expect(params.get('os')).toBe('Windows');
    expect(params.get('browser')).toBe('Chrome');
    expect(params.get('platform')).toBe('desktop');
    expect(params.get('screen_class')).toBe('XL');
  });

  it('should set UTM parameters', () => {
    const params = buildFilterParams(
      {
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'summer-sale',
        utm_content: 'header-cta',
        utm_term: 'analytics',
      },
      domainId
    );

    expect(params.get('utm_source')).toBe('newsletter');
    expect(params.get('utm_medium')).toBe('email');
    expect(params.get('utm_campaign')).toBe('summer-sale');
    expect(params.get('utm_content')).toBe('header-cta');
    expect(params.get('utm_term')).toBe('analytics');
  });

  it('should set pagination and sorting', () => {
    const params = buildFilterParams(
      {
        offset: 10,
        limit: 50,
        sort: 'visitors',
        direction: 'desc',
        search: 'blog',
      },
      domainId
    );

    expect(params.get('offset')).toBe('10');
    expect(params.get('limit')).toBe('50');
    expect(params.get('sort')).toBe('visitors');
    expect(params.get('direction')).toBe('desc');
    expect(params.get('search')).toBe('blog');
  });

  it('should set boolean parameters as strings', () => {
    const params = buildFilterParams(
      {
        include_avg_time_on_page: true,
        include_title: false,
      },
      domainId
    );

    expect(params.get('include_avg_time_on_page')).toBe('true');
    expect(params.get('include_title')).toBe('false');
  });

  it('should set numeric start parameter', () => {
    const params = buildFilterParams({ start: 600 }, domainId);
    expect(params.get('start')).toBe('600');
  });

  it('should ignore undefined, null, and empty string values', () => {
    const params = buildFilterParams(
      {
        from: undefined,
        to: '',
        path: null as unknown as string,
        hostname: 'valid.com',
      },
      domainId
    );

    expect(params.has('from')).toBe(false);
    expect(params.has('to')).toBe(false);
    expect(params.has('path')).toBe(false);
    expect(params.get('hostname')).toBe('valid.com');
  });

  it('should set session filters', () => {
    const params = buildFilterParams(
      {
        visitor_id: 'visitor-123',
        session_id: 'session-456',
      },
      domainId
    );

    expect(params.get('visitor_id')).toBe('visitor-123');
    expect(params.get('session_id')).toBe('session-456');
  });

  it('should set custom metric filters', () => {
    const params = buildFilterParams(
      {
        custom_metric_type: 'float',
        custom_metric_key: 'revenue',
      },
      domainId
    );

    expect(params.get('custom_metric_type')).toBe('float');
    expect(params.get('custom_metric_key')).toBe('revenue');
  });

  it('should set tag filter', () => {
    const params = buildFilterParams({ tag: 'premium' }, domainId);
    expect(params.get('tag')).toBe('premium');
  });
});
