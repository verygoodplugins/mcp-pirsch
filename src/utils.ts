import type { VisitorsPoint } from './types.js';

export type PirschPeriod = 'today' | 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth';

function dateInTimezone(now: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
}

export function getDateRange(period: PirschPeriod, timezone = 'UTC', now = new Date()) {
  const start = dateInTimezone(now, timezone);
  const end = new Date(start);

  switch (period) {
    case 'today':
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    case 'yesterday':
      start.setUTCDate(start.getUTCDate() - 1);
      end.setTime(start.getTime());
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    case 'week': {
      const day = start.getUTCDay();
      start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
      end.setTime(start.getTime());
      end.setUTCDate(start.getUTCDate() + 6);
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'lastWeek': {
      const day = start.getUTCDay();
      start.setUTCDate(start.getUTCDate() - ((day + 6) % 7) - 7);
      end.setTime(start.getTime());
      end.setUTCDate(start.getUTCDate() + 6);
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'month': {
      start.setUTCDate(1);
      end.setUTCMonth(start.getUTCMonth() + 1, 0);
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }
    case 'lastMonth': {
      start.setUTCMonth(start.getUTCMonth() - 1, 1);
      end.setTime(start.getTime());
      end.setUTCMonth(start.getUTCMonth() + 1, 0);
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }
  }
  end.setUTCHours(23, 59, 59, 999);
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
