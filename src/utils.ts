import type { VisitorsPoint } from './types.js';

export function getDateRange(period: 'today' | 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth') {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate());
      end.setHours(23, 59, 59, 999);
      return { start, end };
    case 'week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'lastWeek': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'month': {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'lastMonth': {
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }
  // Default today
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function sumSeries(series: VisitorsPoint[]): VisitorsPoint {
  return series.reduce((acc, p) => ({
    visitors: acc.visitors + (p.visitors || 0),
    views: acc.views + (p.views || 0),
    sessions: acc.sessions + (p.sessions || 0),
    bounces: acc.bounces + (p.bounces || 0),
    bounce_rate: 0, // compute later
    cr: 0,
  }), { visitors: 0, views: 0, sessions: 0, bounces: 0, bounce_rate: 0, cr: 0 });
}

export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return (curr - prev) / prev;
}

