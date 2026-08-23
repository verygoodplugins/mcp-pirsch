import { describe, expect, it } from 'vitest';
import { filterOptionMetrics, statisticsMetrics } from './metrics.js';

describe('metric registries', () => {
  it('exposes documented statistics metrics with their required inputs', () => {
    expect(statisticsMetrics.pages).toMatchObject({ endpoint: '/statistics/page', dateRange: 'required' });
    expect(statisticsMetrics.session_details).toMatchObject({ endpoint: '/statistics/session/details', requires: ['visitorId', 'sessionId'] });
    expect(statisticsMetrics.active).toMatchObject({ endpoint: '/statistics/active', dateRange: 'optional' });
  });

  it('exposes documented filter-option endpoints', () => {
    expect(filterOptionMetrics.event).toBe('/options/event');
    expect(filterOptionMetrics.tagValue).toBe('/options/tag/value');
  });
});
