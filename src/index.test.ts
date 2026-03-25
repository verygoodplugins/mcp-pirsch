import { describe, it, expect, vi } from 'vitest';
import type { StatisticsTotals, VisitorsPoint } from './types.js';

process.env.PIRSCH_CLIENT_ID = process.env.PIRSCH_CLIENT_ID || 'test-client-id';
process.env.PIRSCH_CLIENT_SECRET = process.env.PIRSCH_CLIENT_SECRET || 'test-client-secret';

const { getComparisonResponse, normalizeFilterArgs } = await import('./index.js');

describe('getComparisonResponse', () => {
  it('uses statistics/total for totals and statistics/visitor for chart series', async () => {
    const currentTotals: StatisticsTotals = {
      visitors: 100,
      views: 250,
      sessions: 120,
      bounces: 45,
      bounce_rate: 0.375,
      cr: 0.12,
      custom_metric_avg: 14.5,
      custom_metric_total: 1450,
    };
    const previousTotals: StatisticsTotals = {
      visitors: 80,
      views: 200,
      sessions: 110,
      bounces: 50,
      bounce_rate: 0.4545,
      cr: 0.08,
      custom_metric_avg: 10,
      custom_metric_total: 800,
    };
    const currentSeries: VisitorsPoint[] = [
      { day: '2024-01-01T00:00:00Z', visitors: 40, views: 100, sessions: 50, bounces: 20, bounce_rate: 0.4, cr: 0.1 },
    ];
    const previousSeries: VisitorsPoint[] = [
      { day: '2023-12-25T00:00:00Z', visitors: 30, views: 90, sessions: 45, bounces: 18, bounce_rate: 0.4, cr: 0.08 },
    ];

    const getStatistics = vi
      .fn()
      .mockResolvedValueOnce(currentTotals)
      .mockResolvedValueOnce(previousTotals)
      .mockResolvedValueOnce(currentSeries)
      .mockResolvedValueOnce(previousSeries);

    const result = await getComparisonResponse(
      { getStatistics },
      'domain-1',
      {
        compare: 'custom',
        from: '2024-01-01',
        to: '2024-01-07',
        compare_from: '2023-12-25',
        compare_to: '2023-12-31',
        scale: 'week',
      }
    );

    expect(getStatistics).toHaveBeenNthCalledWith(1, '/statistics/total', 'domain-1', {
      from: '2024-01-01',
      to: '2024-01-07',
    });
    expect(getStatistics).toHaveBeenNthCalledWith(2, '/statistics/total', 'domain-1', {
      from: '2023-12-25',
      to: '2023-12-31',
    });
    expect(getStatistics).toHaveBeenNthCalledWith(3, '/statistics/visitor', 'domain-1', {
      from: '2024-01-01',
      to: '2024-01-07',
      scale: 'week',
    });
    expect(getStatistics).toHaveBeenNthCalledWith(4, '/statistics/visitor', 'domain-1', {
      from: '2023-12-25',
      to: '2023-12-31',
      scale: 'week',
    });

    expect(result.totals.visitors).toEqual({ current: 100, previous: 80, change: 0.25 });
    expect(result.totals.bounce_rate.current).toBe(0.375);
    expect(result.totals.cr.current).toBe(0.12);
    expect(result.totals.custom_metric_total.current).toBe(1450);
    expect(result.series.current).toEqual(currentSeries);
    expect(result.series.previous).toEqual(previousSeries);
  });

  it('rejects invalid compare input', async () => {
    const getStatistics = vi.fn();

    await expect(getComparisonResponse({ getStatistics }, 'domain-1', { compare: 'custom' })).rejects.toThrow(
      'Provide either period or custom from/to + compare_from/compare_to'
    );
    expect(getStatistics).not.toHaveBeenCalled();
  });
});

describe('normalizeFilterArgs', () => {
  it('merges top-level filter args for callers that do not nest filter', () => {
    expect(
      normalizeFilterArgs({
        from: '2024-03-25',
        to: '2026-03-25',
        search: '/news/',
        limit: 5,
        sort: 'visitors',
        direction: 'desc',
      })
    ).toEqual({
      from: '2024-03-25',
      to: '2026-03-25',
      search: '/news/',
      limit: 5,
      sort: 'visitors',
      direction: 'desc',
    });
  });

  it('prefers explicit nested filter values and supports event_name alias', () => {
    expect(
      normalizeFilterArgs({
        event: 'Top Level Event',
        event_name: 'Order',
        filter: {
          search: '/tutorials/',
          event_name: 'Live Demo Signup',
          limit: 10,
        },
      })
    ).toEqual({
      search: '/tutorials/',
      event: 'Top Level Event',
      limit: 10,
    });

    expect(
      normalizeFilterArgs({
        event_name: 'Order',
        filter: {
          from: '2024-03-25',
          to: '2026-03-25',
        },
      })
    ).toEqual({
      from: '2024-03-25',
      to: '2026-03-25',
      event: 'Order',
    });
  });
});
