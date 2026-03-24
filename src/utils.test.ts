import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDateRange, isoDate, sumSeries, pctChange } from './utils.js';
import type { VisitorsPoint } from './types.js';

describe('utils', () => {
  describe('isoDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-03-15T10:30:00Z');
      expect(isoDate(date)).toBe('2024-03-15');
    });

    it('should handle dates with single digit month/day', () => {
      const date = new Date('2024-01-05T00:00:00Z');
      expect(isoDate(date)).toBe('2024-01-05');
    });
  });

  describe('sumSeries', () => {
    it('should sum all numeric fields from visitor points', () => {
      const series: VisitorsPoint[] = [
        { visitors: 100, views: 200, sessions: 120, bounces: 50, bounce_rate: 0.4, cr: 0.1 },
        { visitors: 150, views: 300, sessions: 180, bounces: 60, bounce_rate: 0.35, cr: 0.15 },
      ];

      const result = sumSeries(series);

      expect(result.visitors).toBe(250);
      expect(result.views).toBe(500);
      expect(result.sessions).toBe(300);
      expect(result.bounces).toBe(110);
      expect(result.bounce_rate).toBe(0); // Not summed, computed separately
      expect(result.cr).toBe(0); // Not summed
    });

    it('should return zeros for empty array', () => {
      const result = sumSeries([]);
      expect(result.visitors).toBe(0);
      expect(result.views).toBe(0);
      expect(result.sessions).toBe(0);
      expect(result.bounces).toBe(0);
    });

    it('should handle undefined/null values', () => {
      const series: VisitorsPoint[] = [
        { visitors: 100, views: 200, sessions: 0, bounces: 0, bounce_rate: 0, cr: 0 },
      ];

      const result = sumSeries(series);
      expect(result.visitors).toBe(100);
      expect(result.views).toBe(200);
    });
  });

  describe('pctChange', () => {
    it('should calculate positive percentage change', () => {
      expect(pctChange(150, 100)).toBe(0.5); // 50% increase
    });

    it('should calculate negative percentage change', () => {
      expect(pctChange(75, 100)).toBe(-0.25); // 25% decrease
    });

    it('should return null when previous is zero', () => {
      expect(pctChange(100, 0)).toBeNull();
    });

    it('should handle equal values (no change)', () => {
      expect(pctChange(100, 100)).toBe(0);
    });

    it('should handle negative to positive changes', () => {
      expect(pctChange(200, 100)).toBe(1); // 100% increase
    });
  });

  describe('getDateRange', () => {
    // Mock Date for consistent testing
    const mockDate = new Date('2024-03-15T12:00:00Z'); // Friday

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return today range', () => {
      const { start, end } = getDateRange('today');
      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(2); // March (0-indexed)
      expect(start.getDate()).toBe(15);
      expect(start.getHours()).toBe(0);
      expect(end.getHours()).toBe(23);
    });

    it('should return yesterday range', () => {
      const { start, end } = getDateRange('yesterday');
      expect(start.getDate()).toBe(14);
      expect(end.getDate()).toBe(14);
    });

    it('should return current week range (Monday to Sunday)', () => {
      const { start, end } = getDateRange('week');
      // March 15, 2024 is Friday, week starts Monday March 11
      expect(start.getDate()).toBe(11);
      expect(end.getDate()).toBe(17); // Sunday
    });

    it('should return last week range', () => {
      const { start, end } = getDateRange('lastWeek');
      // Previous week: March 4-10
      expect(start.getDate()).toBe(4);
      expect(end.getDate()).toBe(10);
    });

    it('should return current month range', () => {
      const { start, end } = getDateRange('month');
      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBe(31); // March has 31 days
    });

    it('should return last month range', () => {
      const { start, end } = getDateRange('lastMonth');
      // February 2024 (leap year, so 29 days)
      expect(start.getMonth()).toBe(1); // February
      expect(start.getDate()).toBe(1);
      expect(end.getMonth()).toBe(1);
      expect(end.getDate()).toBe(29);
    });
  });
});
