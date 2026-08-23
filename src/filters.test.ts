import { describe, expect, it } from 'vitest';
import { buildFilterParams, validateV1Filter } from './filters.js';

describe('buildFilterParams', () => {
  it('always includes the explicitly selected domain', () => {
    expect(buildFilterParams({}, 'domain-1').get('id')).toBe('domain-1');
  });

  it('converts public camelCase filters to documented Pirsch parameter names', () => {
    const params = buildFilterParams(
      {
        from: '2026-01-01',
        to: '2026-01-31',
        fromTime: '09:00',
        eventMetaKey: 'plan',
        entryPath: '/pricing',
        operatingSystem: 'macOS',
        utmCampaign: 'launch',
        includeAverageTimeOnPage: true,
        visitorId: 'visitor-1',
        sessionId: 'session-1',
      },
      'domain-1'
    );

    expect(Object.fromEntries(params)).toMatchObject({
      id: 'domain-1',
      from: '2026-01-01',
      to: '2026-01-31',
      from_time: '09:00',
      event_meta_key: 'plan',
      entry_path: '/pricing',
      os: 'macOS',
      utm_campaign: 'launch',
      include_avg_time_on_page: 'true',
      visitor_id: 'visitor-1',
      session_id: 'session-1',
    });
  });

  it('applies a configured timezone only when a tool input does not specify one', () => {
    expect(buildFilterParams({}, 'domain-1', 'Europe/Berlin').get('tz')).toBe('Europe/Berlin');
    expect(buildFilterParams({ timezone: 'UTC' }, 'domain-1', 'Europe/Berlin').get('tz')).toBe('UTC');
  });

  it('rejects nonexistent calendar dates before an upstream request', () => {
    expect(() => validateV1Filter({ from: '2026-02-31' })).toThrow('from must be an ISO date.');
  });
});
