import { z } from 'zod';
import { filterOptionMetrics, statisticsMetrics, type FilterOptionMetric, type StatisticsMetric } from './metrics.js';

const optionalString = z.string().trim().min(1).optional();

export const filterInputSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  fromTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  toTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  timezone: optionalString,
  start: z.number().int().min(0).max(3_600).optional(),
  scale: z.enum(['day', 'week', 'month', 'year']).optional(),
  hostname: optionalString,
  path: optionalString,
  entryPath: optionalString,
  exitPath: optionalString,
  pattern: optionalString,
  event: optionalString,
  eventMetaKey: optionalString,
  language: optionalString,
  country: optionalString,
  region: optionalString,
  city: optionalString,
  referrer: optionalString,
  referrerName: optionalString,
  channel: optionalString,
  operatingSystem: optionalString,
  browser: optionalString,
  platform: z.enum(['desktop', 'mobile', 'unknown']).optional(),
  screenClass: optionalString,
  utmSource: optionalString,
  utmMedium: optionalString,
  utmCampaign: optionalString,
  utmContent: optionalString,
  utmTerm: optionalString,
  customMetricType: z.enum(['integer', 'float']).optional(),
  customMetricKey: optionalString,
  tags: optionalString,
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  includeAverageTimeOnPage: z.boolean().optional(),
  includeTitle: z.boolean().optional(),
  sort: optionalString,
  direction: z.enum(['asc', 'desc']).optional(),
  search: optionalString,
  keyword: optionalString,
  visitorId: optionalString,
  sessionId: optionalString,
});

const selectedDomainSchema = z.object({ domainId: optionalString });
const statisticsMetricValues = Object.keys(statisticsMetrics) as [StatisticsMetric, ...StatisticsMetric[]];
const filterOptionValues = Object.keys(filterOptionMetrics) as [FilterOptionMetric, ...FilterOptionMetric[]];

type DateRangeInput = { from?: string; to?: string; fromTime?: string; toTime?: string; compareFrom?: string; compareTo?: string };

function validateChronologicalRanges(input: DateRangeInput, ctx: z.RefinementCtx): void {
  for (const [fromKey, toKey] of [['from', 'to'], ['compareFrom', 'compareTo']] as const) {
    const from = input[fromKey];
    const to = input[toKey];
    if (from && to && from > to) {
      ctx.addIssue({ code: 'custom', path: [toKey], message: `${fromKey} must be on or before ${toKey}.` });
    }
    if (from && to && from === to && input.fromTime && input.toTime && input.fromTime > input.toTime) {
      ctx.addIssue({ code: 'custom', path: ['toTime'], message: 'toTime must be on or after fromTime for a same-day range.' });
    }
  }
}

export const listDomainsInputSchema = z.object({});
export const statisticsQuerySchema = selectedDomainSchema
  .extend({ metric: z.enum(statisticsMetricValues) })
  .extend(filterInputSchema.shape)
  .superRefine(validateChronologicalRanges);
export const filterOptionsInputSchema = selectedDomainSchema
  .extend({ option: z.enum(filterOptionValues) })
  .extend(filterInputSchema.shape)
  .superRefine((input, ctx) => {
    validateChronologicalRanges(input, ctx);
    if (input.option === 'tagValue' && !input.tags) {
      ctx.addIssue({ code: 'custom', path: ['tags'], message: 'tags is required when option is tagValue.' });
    }
    if (input.option === 'metadata' && !input.eventMetaKey) {
      ctx.addIssue({ code: 'custom', path: ['eventMetaKey'], message: 'eventMetaKey is required when option is metadata.' });
    }
  });
export const comparisonInputSchema = selectedDomainSchema
  .extend({
    period: z.enum(['today', 'yesterday', 'week', 'lastWeek', 'month', 'lastMonth']).optional(),
    compareFrom: z.iso.date().optional(),
    compareTo: z.iso.date().optional(),
  })
  .extend(filterInputSchema.shape)
  .superRefine((input, ctx) => {
    validateChronologicalRanges(input, ctx);
    const hasExplicitRangeField = [input.from, input.to, input.compareFrom, input.compareTo].some((value) => value !== undefined);
    if (input.period && hasExplicitRangeField) {
      ctx.addIssue({ code: 'custom', path: ['period'], message: 'period cannot be combined with explicit comparison dates.' });
    }
  });

export const safeDomainOutputSchema = z.object({
  id: z.string(),
  hostname: z.string().optional(),
  displayName: z.string().optional(),
  timezone: z.string().optional(),
});
export const domainsOutputSchema = z.object({ domains: z.array(safeDomainOutputSchema) });
export const statisticsOutputSchema = z.object({ domainId: z.string(), metric: z.string(), data: z.unknown() });
export const filterOptionsOutputSchema = z.object({ domainId: z.string(), option: z.string(), data: z.unknown() });
export const comparisonOutputSchema = z.object({
  domainId: z.string(),
  current: z.object({ from: z.string(), to: z.string() }),
  previous: z.object({ from: z.string(), to: z.string() }),
  totals: z.record(z.string(), z.object({ current: z.number(), previous: z.number(), change: z.number().nullable() })),
  series: z.object({ current: z.unknown(), previous: z.unknown() }),
});

export type StatisticsQuery = z.infer<typeof statisticsQuerySchema>;
export type FilterOptionsQuery = z.infer<typeof filterOptionsInputSchema>;
export type ComparisonQuery = z.infer<typeof comparisonInputSchema>;
