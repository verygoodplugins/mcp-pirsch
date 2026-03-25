#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { PirschAPI } from './pirsch-api.js';
import type { Domain, FilterInput, StatisticsTotals, VisitorsPoint } from './types.js';
import { getDateRange, isoDate, pctChange } from './utils.js';

config();

const CLIENT_ID = process.env.PIRSCH_CLIENT_ID;
const CLIENT_SECRET = process.env.PIRSCH_CLIENT_SECRET;
const DEFAULT_DOMAIN_ID = process.env.PIRSCH_DEFAULT_DOMAIN_ID;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required env: PIRSCH_CLIENT_ID or PIRSCH_CLIENT_SECRET');
  process.exit(1);
}

const api = new PirschAPI(CLIENT_ID, CLIENT_SECRET);

type ToolArguments = Record<string, unknown>;
type PeriodName = 'today' | 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth';
type ScaleName = 'day' | 'week' | 'month' | 'year';
type CompareMode = 'previous' | 'year' | 'custom';
type SchemaProperty = { [key: string]: unknown };
type ToolInputSchema = {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
};

interface StatisticsToolConfig {
  name: string;
  description: string;
  endpoint: string;
  resultKey: string;
  supportsLocalPathPrefix?: boolean;
  validateFilter?: (filter: FilterInput) => void;
}

interface StatisticsReader {
  getStatistics<T = unknown>(endpoint: string, domainId: string, filter?: FilterInput): Promise<T>;
}

interface PathRow {
  path?: string | null;
}

const DEFAULT_LOCAL_FILTER_BATCH_SIZE = 100;
const MAX_LOCAL_FILTER_BATCHES = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDomain(value: unknown): value is Domain {
  return isRecord(value) && typeof value.id === 'string';
}

function formatResponse(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An error occurred';
}

function readArgs(value: unknown): ToolArguments | undefined {
  return isRecord(value) ? value : undefined;
}

function readOptionalString(args: ToolArguments | undefined, key: string): string | undefined {
  const value = args?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function readOptionalNumber(args: ToolArguments | undefined, key: string): number | undefined {
  const value = args?.[key];
  return typeof value === 'number' ? value : undefined;
}

function readFilter(args: ToolArguments | undefined): FilterInput {
  const filter = args?.filter;
  return isRecord(filter) ? (filter as FilterInput) : {};
}

function readFilterAlias(
  args: ToolArguments | undefined,
  nestedFilter: FilterInput,
  key: 'event_name'
): string | undefined {
  const nestedValue = nestedFilter[key];
  if (typeof nestedValue === 'string' && nestedValue.trim() !== '') {
    return nestedValue;
  }

  const topLevelValue = args?.[key];
  return typeof topLevelValue === 'string' && topLevelValue.trim() !== '' ? topLevelValue : undefined;
}

export function normalizeFilterArgs(args: ToolArguments | undefined): FilterInput {
  const nestedFilter = readFilter(args);
  const mergedFilter: FilterInput = { ...nestedFilter };
  const mergedFilterRecord = mergedFilter as Record<string, unknown>;

  for (const key of Object.keys(filterSchemaProperties) as Array<keyof FilterInput>) {
    const value = args?.[key];
    if (value !== undefined && mergedFilter[key] === undefined) {
      mergedFilterRecord[key] = value;
    }
  }

  if (!mergedFilter.event) {
    const eventAlias = readFilterAlias(args, nestedFilter, 'event_name');
    if (eventAlias) {
      mergedFilter.event = eventAlias;
    }
  }

  delete mergedFilter.event_name;

  return mergedFilter;
}

function readTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function normalizePathPrefix(value: string | undefined): string | undefined {
  if (!value || !value.startsWith('/')) {
    return undefined;
  }

  return value;
}

function extractPatternPrefix(pattern: string | undefined): string | undefined {
  if (!pattern || !pattern.startsWith('/') || !pattern.endsWith('*')) {
    return undefined;
  }

  const prefix = pattern.slice(0, -1);
  return prefix.endsWith('/') ? prefix : undefined;
}

export function getLocalPathPrefix(filter: FilterInput): string | undefined {
  const explicitPrefix = normalizePathPrefix(readTrimmedString(filter.path_prefix));
  if (explicitPrefix) {
    return explicitPrefix;
  }

  const searchPrefix = normalizePathPrefix(readTrimmedString(filter.search));
  if (searchPrefix) {
    return searchPrefix;
  }

  const path = readTrimmedString(filter.path);
  if (path?.startsWith('~/')) {
    return normalizePathPrefix(path.slice(1));
  }

  return extractPatternPrefix(readTrimmedString(filter.pattern));
}

function filterRowsByPathPrefix<T>(rows: T[], prefix: string): T[] {
  return rows.filter((row) => isRecord(row) && typeof row.path === 'string' && row.path.startsWith(prefix));
}

function buildApiFilterForLocalPathPrefix(
  filter: FilterInput,
  prefix: string,
  offset: number,
  limit: number
): FilterInput {
  const apiFilter: FilterInput = {
    ...filter,
    offset,
    limit,
  };

  delete apiFilter.path_prefix;

  if (!apiFilter.search && !apiFilter.path && !apiFilter.pattern) {
    apiFilter.search = prefix;
  }

  return apiFilter;
}

export async function getPathFilteredStatistics(
  client: StatisticsReader,
  endpoint: string,
  domainId: string,
  filter: FilterInput,
  prefix: string
): Promise<PathRow[] | unknown> {
  const requestedOffset = filter.offset ?? 0;
  const requestedLimit = filter.limit ?? DEFAULT_LOCAL_FILTER_BATCH_SIZE;
  const targetCount = requestedOffset + requestedLimit;
  const batchSize = Math.max(requestedLimit, DEFAULT_LOCAL_FILTER_BATCH_SIZE);
  const matches: PathRow[] = [];

  for (let batchIndex = 0; batchIndex < MAX_LOCAL_FILTER_BATCHES && matches.length < targetCount; batchIndex += 1) {
    const data = await client.getStatistics<unknown>(
      endpoint,
      domainId,
      buildApiFilterForLocalPathPrefix(filter, prefix, batchIndex * batchSize, batchSize)
    );

    if (!Array.isArray(data)) {
      return data;
    }

    matches.push(...filterRowsByPathPrefix(data, prefix));

    if (data.length < batchSize) {
      break;
    }
  }

  return matches.slice(requestedOffset, targetCount);
}

function requireFilterString(filter: FilterInput, key: 'event' | 'visitor_id' | 'session_id', toolName: string): string {
  const value = filter[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`filter.${key} is required for ${toolName}`);
  }
  return value;
}

function buildFilterCapableInputSchema(
  extraProperties: Record<string, SchemaProperty> = {},
  required?: string[]
): ToolInputSchema {
  return {
    type: 'object',
    properties: {
      domain_id: domainIdSchema,
      filter: filterSchema,
      ...filterSchemaProperties,
      ...extraProperties,
    },
    ...(required ? { required } : {}),
  };
}

function compareMetric(current: number, previous: number) {
  return { current, previous, change: pctChange(current, previous) };
}

export function buildComparisonTotals(current: StatisticsTotals, previous: StatisticsTotals) {
  return {
    visitors: compareMetric(current.visitors, previous.visitors),
    views: compareMetric(current.views, previous.views),
    sessions: compareMetric(current.sessions, previous.sessions),
    bounces: compareMetric(current.bounces, previous.bounces),
    bounce_rate: compareMetric(current.bounce_rate, previous.bounce_rate),
    cr: compareMetric(current.cr, previous.cr),
    custom_metric_avg: compareMetric(current.custom_metric_avg, previous.custom_metric_avg),
    custom_metric_total: compareMetric(current.custom_metric_total, previous.custom_metric_total),
  };
}

export async function getComparisonResponse(
  client: StatisticsReader,
  domainId: string,
  args: ToolArguments | undefined
) {
  const scale = (readOptionalString(args, 'scale') as ScaleName | undefined) || 'day';
  const compareMode = (readOptionalString(args, 'compare') as CompareMode | undefined) || 'previous';
  const period = readOptionalString(args, 'period') as PeriodName | undefined;

  let currentFrom: string;
  let currentTo: string;
  let previousFrom: string;
  let previousTo: string;

  if (period) {
    const range = getDateRange(period);
    currentFrom = isoDate(range.start);
    currentTo = isoDate(range.end);

    if (compareMode === 'year') {
      const previousStart = new Date(range.start);
      const previousEnd = new Date(range.end);
      previousStart.setFullYear(previousStart.getFullYear() - 1);
      previousEnd.setFullYear(previousEnd.getFullYear() - 1);
      previousFrom = isoDate(previousStart);
      previousTo = isoDate(previousEnd);
    } else {
      const lengthInDays =
        Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const previousEnd = new Date(range.start);
      previousEnd.setDate(previousEnd.getDate() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setDate(previousEnd.getDate() - (lengthInDays - 1));
      previousFrom = isoDate(previousStart);
      previousTo = isoDate(previousEnd);
    }
  } else if (
    compareMode === 'custom' &&
    readOptionalString(args, 'from') &&
    readOptionalString(args, 'to') &&
    readOptionalString(args, 'compare_from') &&
    readOptionalString(args, 'compare_to')
  ) {
    currentFrom = readOptionalString(args, 'from')!;
    currentTo = readOptionalString(args, 'to')!;
    previousFrom = readOptionalString(args, 'compare_from')!;
    previousTo = readOptionalString(args, 'compare_to')!;
  } else {
    throw new Error('Provide either period or custom from/to + compare_from/compare_to');
  }

  const [currentTotals, previousTotals, currentSeries, previousSeries] = await Promise.all([
    client.getStatistics<StatisticsTotals>('/statistics/total', domainId, {
      from: currentFrom,
      to: currentTo,
    }),
    client.getStatistics<StatisticsTotals>('/statistics/total', domainId, {
      from: previousFrom,
      to: previousTo,
    }),
    client.getStatistics<VisitorsPoint[]>('/statistics/visitor', domainId, {
      from: currentFrom,
      to: currentTo,
      scale,
    }),
    client.getStatistics<VisitorsPoint[]>('/statistics/visitor', domainId, {
      from: previousFrom,
      to: previousTo,
      scale,
    }),
  ]);

  return {
    period: { from: currentFrom, to: currentTo },
    compare_to: { from: previousFrom, to: previousTo },
    totals: buildComparisonTotals(currentTotals, previousTotals),
    series: { current: currentSeries, previous: previousSeries },
  };
}

async function resolveDomainId(argId?: string): Promise<string> {
  if (argId) return argId;
  if (DEFAULT_DOMAIN_ID) return DEFAULT_DOMAIN_ID;
  const res = await api.listDomains();
  if (Array.isArray(res) && res.length > 0) return res[0].id;
  if (isDomain(res)) return res.id;
  throw new Error('No domain found. Set PIRSCH_DEFAULT_DOMAIN_ID or provide domain_id');
}

const server = new Server(
  { name: 'mcp-pirsch', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

const filterSchemaProperties = {
  from: { type: 'string', description: 'YYYY-MM-DD' },
  to: { type: 'string', description: 'YYYY-MM-DD' },
  from_time: { type: 'string', description: 'HH:MM (same-day only)' },
  to_time: { type: 'string', description: 'HH:MM (same-day only)' },
  tz: { type: 'string' },
  start: { type: 'number', description: 'Past seconds for active view' },
  scale: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
  hostname: { type: 'string' },
  path: { type: 'string', description: 'Supports Pirsch operators like ~contains, !not, and ^does-not-contain' },
  path_prefix: { type: 'string', description: 'MCP-local path prefix filter for page-style tools, e.g. /tutorials/' },
  entry_path: { type: 'string' },
  exit_path: { type: 'string' },
  pattern: { type: 'string' },
  event: { type: 'string' },
  event_name: { type: 'string', description: 'Alias for event when callers use event_name instead of event' },
  event_meta_key: { type: 'string' },
  language: { type: 'string' },
  country: { type: 'string' },
  city: { type: 'string' },
  referrer: { type: 'string' },
  referrer_name: { type: 'string' },
  channel: { type: 'string' },
  os: { type: 'string' },
  browser: { type: 'string' },
  platform: { type: 'string', enum: ['desktop', 'mobile', 'unknown'] },
  screen_class: { type: 'string' },
  utm_source: { type: 'string' },
  utm_medium: { type: 'string' },
  utm_campaign: { type: 'string' },
  utm_content: { type: 'string' },
  utm_term: { type: 'string' },
  custom_metric_type: { type: 'string', enum: ['integer', 'float'] },
  custom_metric_key: { type: 'string' },
  tag: { type: 'string' },
  offset: { type: 'number' },
  limit: { type: 'number' },
  include_avg_time_on_page: { type: 'boolean' },
  include_title: { type: 'boolean' },
  sort: { type: 'string' },
  direction: { type: 'string', enum: ['asc', 'desc'] },
  search: { type: 'string', description: 'Contains search on the primary field, e.g. page path for page endpoints' },
  keyword: { type: 'string', description: 'Google Search Console keyword filter for keyword page lookups' },
  visitor_id: { type: 'string' },
  session_id: { type: 'string' },
} as const;

const filterSchema: ToolInputSchema = {
  type: 'object',
  properties: filterSchemaProperties,
};

const domainIdSchema = { type: 'string' } as const;

const filterToolInputSchema = buildFilterCapableInputSchema();

const statisticsToolConfigs: StatisticsToolConfig[] = [
  {
    name: 'pirsch_total',
    description: 'Get totals for visitors, views, sessions, bounces, bounce_rate, cr, and custom metrics with filters',
    endpoint: '/statistics/total',
    resultKey: 'total',
  },
  {
    name: 'pirsch_visitors',
    description: 'Get visitors time series with optional scale and filters',
    endpoint: '/statistics/visitor',
    resultKey: 'series',
  },
  {
    name: 'pirsch_pages',
    description: 'Get page stats with sorting, search, and optional average time on page',
    endpoint: '/statistics/page',
    resultKey: 'pages',
    supportsLocalPathPrefix: true,
  },
  {
    name: 'pirsch_entry_pages',
    description: 'Get entry page stats with sorting, search, and optional average time on page',
    endpoint: '/statistics/page/entry',
    resultKey: 'entry_pages',
    supportsLocalPathPrefix: true,
  },
  {
    name: 'pirsch_exit_pages',
    description: 'Get exit page stats with sorting and search',
    endpoint: '/statistics/page/exit',
    resultKey: 'exit_pages',
    supportsLocalPathPrefix: true,
  },
  {
    name: 'pirsch_referrers',
    description: 'Get referrer statistics with filters and sorting',
    endpoint: '/statistics/referrer',
    resultKey: 'referrers',
  },
  {
    name: 'pirsch_goals',
    description: 'Get conversion goals and their performance stats',
    endpoint: '/statistics/goals',
    resultKey: 'goals',
  },
  {
    name: 'pirsch_events',
    description: 'Get event statistics with counts, visitors, conversion rate, and metadata keys',
    endpoint: '/statistics/events',
    resultKey: 'events',
  },
  {
    name: 'pirsch_event_pages',
    description: 'Get pages on which a specific event fired. Requires filter.event',
    endpoint: '/statistics/event/page',
    resultKey: 'event_pages',
    supportsLocalPathPrefix: true,
    validateFilter: (filter) => {
      requireFilterString(filter, 'event', 'pirsch_event_pages');
    },
  },
  {
    name: 'pirsch_growth',
    description: 'Get growth rates across core metrics for the selected period',
    endpoint: '/statistics/growth',
    resultKey: 'growth',
  },
  {
    name: 'pirsch_sessions',
    description: 'Get session list with entry/exit pages, duration, device, and traffic source details',
    endpoint: '/statistics/session/list',
    resultKey: 'sessions',
  },
  {
    name: 'pirsch_session_details',
    description: 'Get chronological page views and events for a single session. Requires filter.visitor_id and filter.session_id',
    endpoint: '/statistics/session/details',
    resultKey: 'session_details',
    validateFilter: (filter) => {
      requireFilterString(filter, 'visitor_id', 'pirsch_session_details');
      requireFilterString(filter, 'session_id', 'pirsch_session_details');
    },
  },
];

const statisticsToolMap = new Map(statisticsToolConfigs.map((config) => [config.name, config]));

const tools: Tool[] = [
  {
    name: 'pirsch_list_domains',
    description: 'List accessible Pirsch domains to discover domain IDs',
    inputSchema: { type: 'object', properties: { search: { type: 'string' } } },
  },
  {
    name: 'pirsch_overview',
    description: 'Get cached overview statistics for a domain. Filters do not apply to this endpoint',
    inputSchema: { type: 'object', properties: { domain_id: domainIdSchema } },
  },
  ...statisticsToolConfigs.map((config) => ({
    name: config.name,
    description: config.description,
    inputSchema: filterToolInputSchema,
  })),
  {
    name: 'pirsch_utm',
    description: 'Get UTM stats by dimension (source, medium, campaign, content, term)',
    inputSchema: buildFilterCapableInputSchema(
      { type: { type: 'string', enum: ['source', 'medium', 'campaign', 'content', 'term'] } },
      ['type']
    ),
  },
  {
    name: 'pirsch_active',
    description: 'Get active visitors and pages for the past N seconds (default 600)',
    inputSchema: { type: 'object', properties: { domain_id: domainIdSchema, start: { type: 'number' } } },
  },
  {
    name: 'pirsch_compare',
    description: 'Compare totals and visitor series between two periods using true period totals',
    inputSchema: {
      type: 'object',
      properties: {
        domain_id: domainIdSchema,
        period: { type: 'string', enum: ['today', 'yesterday', 'week', 'lastWeek', 'month', 'lastMonth'] },
        compare: {
          type: 'string',
          enum: ['previous', 'year', 'custom'],
          description: 'Compare to the previous period, same period last year, or a custom range',
        },
        from: { type: 'string' },
        to: { type: 'string' },
        compare_from: { type: 'string' },
        compare_to: { type: 'string' },
        scale: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: rawArgs } = req.params;
  const args = readArgs(rawArgs);

  try {
    if (name === 'pirsch_list_domains') {
      const search = readOptionalString(args, 'search');
      const res = await api.listDomains(search ? { search } : undefined);
      const arr = Array.isArray(res) ? res : [res];
      return formatResponse({ count: arr.length, domains: arr });
    }

    if (name === 'pirsch_overview') {
      const domainId = await resolveDomainId(readOptionalString(args, 'domain_id'));
      const data = await api.getOverview(domainId);
      return formatResponse({ domain_id: domainId, overview: data });
    }

    const statisticsTool = statisticsToolMap.get(name);
    if (statisticsTool) {
      const domainId = await resolveDomainId(readOptionalString(args, 'domain_id'));
      const filter = normalizeFilterArgs(args);
      statisticsTool.validateFilter?.(filter);
      const localPathPrefix = statisticsTool.supportsLocalPathPrefix ? getLocalPathPrefix(filter) : undefined;
      const data = localPathPrefix
        ? await getPathFilteredStatistics(api, statisticsTool.endpoint, domainId, filter, localPathPrefix)
        : await api.getStatistics(statisticsTool.endpoint, domainId, filter);
      return formatResponse({ domain_id: domainId, [statisticsTool.resultKey]: data });
    }

    if (name === 'pirsch_utm') {
      const domainId = await resolveDomainId(readOptionalString(args, 'domain_id'));
      const filter = normalizeFilterArgs(args);
      const type = readOptionalString(args, 'type');
      if (!type) {
        throw new Error('type is required for pirsch_utm');
      }
      const endpoint = `/statistics/utm/${type}`;
      const data = await api.getStatistics(endpoint, domainId, filter);
      return formatResponse({ domain_id: domainId, type, utm: data });
    }

    if (name === 'pirsch_active') {
      const domainId = await resolveDomainId(readOptionalString(args, 'domain_id'));
      const start = readOptionalNumber(args, 'start') ?? 600;
      const data = await api.getActive(domainId, start);
      return formatResponse({ domain_id: domainId, start, active: data });
    }

    if (name === 'pirsch_compare') {
      const domainId = await resolveDomainId(readOptionalString(args, 'domain_id'));
      const result = await getComparisonResponse(api, domainId, args);
      return formatResponse(result);
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return formatResponse({ error: true, message: getErrorMessage(error) });
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Pirsch MCP server running');
}

const isDirectExecution =
  typeof process.argv[1] === 'string' && import.meta.url === new URL(process.argv[1], 'file://').href;

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
