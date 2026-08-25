import { McpServer } from '@modelcontextprotocol/server';
import packageJson from '../package.json' with { type: 'json' };
import { filterOptionMetrics, statisticsMetrics } from './metrics.js';
import { PirschClient, type PirschClientOptions } from './pirsch-client.js';
import {
  comparisonInputSchema,
  comparisonOutputSchema,
  domainsOutputSchema,
  filterOptionsInputSchema,
  filterOptionsOutputSchema,
  listDomainsInputSchema,
  statisticsOutputSchema,
  statisticsQuerySchema,
  type ComparisonQuery,
  type FilterOptionsQuery,
  type StatisticsQuery,
} from './schemas.js';
import type { PirschCredentials, PirschFilter, SafeDomain, StatisticsTotals, VisitorsPoint } from './types.js';
import { getDateRange, isoDate, pctChange, type PirschPeriod } from './utils.js';

export interface PirschReader {
  listDomains(): Promise<SafeDomain[]>;
  get<T = unknown>(endpoint: string, domainId: string, filter?: PirschFilter): Promise<T>;
}

export interface PirschServerOptions {
  clientFactory?: () => PirschReader;
  credentials?: PirschCredentials;
  clientOptions?: PirschClientOptions;
  defaultDomainId?: string;
}

const readOnlyAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true } as const;

function jsonResult<T>(output: T) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : 'Pirsch request failed.';
  return { ...jsonResult({ error: true, message }), isError: true };
}

function resolveDomain(domainId: string | undefined, defaultDomainId: string | undefined): string {
  const resolved = domainId ?? defaultDomainId;
  if (!resolved) {
    throw new Error('Specify domainId or configure PIRSCH_DEFAULT_DOMAIN_ID. This server never chooses a domain automatically.');
  }
  return resolved;
}

function validateStatisticQuery(input: StatisticsQuery): void {
  const definition = statisticsMetrics[input.metric];
  if (definition.dateRange === 'required' && (!input.from || !input.to)) {
    throw new Error(`metric '${input.metric}' requires both from and to dates.`);
  }
  const hasFilter = Object.entries(input).some(([key, value]) => key !== 'domainId' && key !== 'metric' && value !== undefined);
  if (definition.dateRange === 'forbidden' && hasFilter) {
    throw new Error(`metric '${input.metric}' does not accept filters.`);
  }
  const requirements = 'requires' in definition ? definition.requires : [];
  for (const field of requirements) {
    if (!(input as Record<string, unknown>)[field]) {
      throw new Error(`metric '${input.metric}' requires ${field}.`);
    }
  }
}

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => typeof item === 'number')) as Record<string, number>;
}

function previousRange(from: string, to: string): { from: string; to: string } {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const spanMs = end.getTime() - start.getTime() + 24 * 60 * 60 * 1_000;
  return {
    from: isoDate(new Date(start.getTime() - spanMs)),
    to: isoDate(new Date(end.getTime() - spanMs)),
  };
}

function validateResolvedClockRange(input: ComparisonQuery, range: { from: string; to: string }): void {
  if (range.from === range.to && input.fromTime && input.toTime && input.fromTime > input.toTime) {
    throw new Error('toTime must be on or after fromTime for a same-day range.');
  }
}

function resolveComparisonRanges(input: ComparisonQuery, timezone?: string) {
  let ranges: { current: { from: string; to: string }; previous: { from: string; to: string } };
  if (input.from && input.to && input.compareFrom && input.compareTo) {
    ranges = { current: { from: input.from, to: input.to }, previous: { from: input.compareFrom, to: input.compareTo } };
  } else if (input.period) {
    const range = getDateRange(input.period as PirschPeriod, timezone);
    const current = { from: isoDate(range.start), to: isoDate(range.end) };
    ranges = { current, previous: previousRange(current.from, current.to) };
  } else {
    throw new Error('Provide period or from/to plus compareFrom/compareTo.');
  }
  validateResolvedClockRange(input, ranges.current);
  validateResolvedClockRange(input, ranges.previous);
  return ranges;
}

async function comparePeriods(reader: PirschReader, domainId: string, input: ComparisonQuery, configuredTimezone?: string) {
  const { current, previous } = resolveComparisonRanges(input, input.timezone ?? configuredTimezone);
  const { domainId: _domainId, period: _period, compareFrom: _compareFrom, compareTo: _compareTo, ...filters } = input;
  const currentFilter = { ...filters, ...current };
  const previousFilter = { ...filters, ...previous };
  const [currentTotals, previousTotals, currentSeries, previousSeries] = await Promise.all([
    reader.get<StatisticsTotals>('/statistics/total', domainId, currentFilter),
    reader.get<StatisticsTotals>('/statistics/total', domainId, previousFilter),
    reader.get<VisitorsPoint[]>('/statistics/visitor', domainId, currentFilter),
    reader.get<VisitorsPoint[]>('/statistics/visitor', domainId, previousFilter),
  ]);
  const currentNumbers = numberRecord(currentTotals);
  const previousNumbers = numberRecord(previousTotals);
  const totals = Object.fromEntries(
    [...new Set([...Object.keys(currentNumbers), ...Object.keys(previousNumbers)])].map((key) => {
      const currentValue = currentNumbers[key] ?? 0;
      const previousValue = previousNumbers[key] ?? 0;
      return [key, { current: currentValue, previous: previousValue, change: pctChange(currentValue, previousValue) }];
    })
  );
  return { domainId, current, previous, totals, series: { current: currentSeries, previous: previousSeries } };
}

export function createPirschServer(options: PirschServerOptions = {}): McpServer {
  const defaultDomainId = options.defaultDomainId ?? process.env.PIRSCH_DEFAULT_DOMAIN_ID;
  const configuredTimezone = options.clientOptions?.timezone ?? process.env.PIRSCH_TIMEZONE;
  let reader: PirschReader | undefined;
  const getReader = () => {
    reader ??= options.clientFactory?.() ?? new PirschClient(
      options.credentials ?? { clientId: process.env.PIRSCH_CLIENT_ID, clientSecret: process.env.PIRSCH_CLIENT_SECRET },
      { ...options.clientOptions, timezone: configuredTimezone }
    );
    return reader;
  };

  const server = new McpServer({ name: 'mcp-pirsch', version: packageJson.version });

  server.registerTool(
    'pirsch_list_domains',
    {
      title: 'List Pirsch domains',
      description: 'List safe summaries of domains available to the configured read-only Pirsch OAuth client.',
      inputSchema: listDomainsInputSchema,
      outputSchema: domainsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async () => {
      try {
        return jsonResult({ domains: await getReader().listDomains() });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'pirsch_query_statistics',
    {
      title: 'Query Pirsch analytics',
      description: 'Read one documented Pirsch Analytics API v1 metric for an explicitly selected domain and filter.',
      inputSchema: statisticsQuerySchema,
      outputSchema: statisticsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      try {
        validateStatisticQuery(input);
        const domainId = resolveDomain(input.domainId, defaultDomainId);
        const { domainId: _domainId, metric, ...filter } = input;
        return jsonResult({ domainId, metric, data: await getReader().get(statisticsMetrics[metric].endpoint, domainId, filter) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'pirsch_list_filter_options',
    {
      title: 'List Pirsch filter options',
      description: 'List supported values for one documented Pirsch Analytics API v1 filter dimension.',
      inputSchema: filterOptionsInputSchema,
      outputSchema: filterOptionsOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input: FilterOptionsQuery) => {
      try {
        const domainId = resolveDomain(input.domainId, defaultDomainId);
        const { domainId: _domainId, option, ...filter } = input;
        return jsonResult({ domainId, option, data: await getReader().get(filterOptionMetrics[option], domainId, filter) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'pirsch_compare_periods',
    {
      title: 'Compare Pirsch periods',
      description: 'Compare Pirsch totals and visitor series for a named or explicitly supplied pair of periods.',
      inputSchema: comparisonInputSchema,
      outputSchema: comparisonOutputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      try {
        const domainId = resolveDomain(input.domainId, defaultDomainId);
        return jsonResult(await comparePeriods(getReader(), domainId, input, configuredTimezone));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  return server;
}
