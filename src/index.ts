#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { PirschAPI } from './pirsch-api.js';
import type { FilterInput, VisitorsPoint } from './types.js';
import { getDateRange, isoDate, sumSeries, pctChange } from './utils.js';

config();

const CLIENT_ID = process.env.PIRSCH_CLIENT_ID;
const CLIENT_SECRET = process.env.PIRSCH_CLIENT_SECRET;
const DEFAULT_DOMAIN_ID = process.env.PIRSCH_DEFAULT_DOMAIN_ID;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required env: PIRSCH_CLIENT_ID or PIRSCH_CLIENT_SECRET');
  process.exit(1);
}

const api = new PirschAPI(CLIENT_ID, CLIENT_SECRET);

async function resolveDomainId(argId?: string): Promise<string> {
  if (argId) return argId;
  if (DEFAULT_DOMAIN_ID) return DEFAULT_DOMAIN_ID;
  const res = await api.listDomains();
  if (Array.isArray(res) && res.length > 0) return res[0].id;
  if (!Array.isArray(res) && (res as any).id) return (res as any).id;
  throw new Error('No domain found. Set PIRSCH_DEFAULT_DOMAIN_ID or provide domain_id');
}

const server = new Server(
  { name: 'mcp-pirsch', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

const filterSchemaProperties: Record<string, any> = {
  from: { type: 'string', description: 'YYYY-MM-DD' },
  to: { type: 'string', description: 'YYYY-MM-DD' },
  from_time: { type: 'string', description: 'HH:MM (same-day only)' },
  to_time: { type: 'string', description: 'HH:MM (same-day only)' },
  tz: { type: 'string' },
  start: { type: 'number', description: 'Past seconds for active view' },
  scale: { type: 'string', enum: ['day','week','month','year'] },
  hostname: { type: 'string' },
  path: { type: 'string' },
  entry_path: { type: 'string' },
  exit_path: { type: 'string' },
  pattern: { type: 'string' },
  event: { type: 'string' },
  event_meta_key: { type: 'string' },
  language: { type: 'string' },
  country: { type: 'string' },
  city: { type: 'string' },
  referrer: { type: 'string' },
  referrer_name: { type: 'string' },
  channel: { type: 'string' },
  os: { type: 'string' },
  browser: { type: 'string' },
  platform: { type: 'string', enum: ['desktop','mobile','unknown'] },
  screen_class: { type: 'string' },
  utm_source: { type: 'string' },
  utm_medium: { type: 'string' },
  utm_campaign: { type: 'string' },
  utm_content: { type: 'string' },
  utm_term: { type: 'string' },
  custom_metric_type: { type: 'string', enum: ['integer','float'] },
  custom_metric_key: { type: 'string' },
  tag: { type: 'string' },
  offset: { type: 'number' },
  limit: { type: 'number' },
  include_avg_time_on_page: { type: 'boolean' },
  include_title: { type: 'boolean' },
  sort: { type: 'string' },
  direction: { type: 'string', enum: ['asc','desc'] },
  search: { type: 'string' },
  visitor_id: { type: 'string' },
  session_id: { type: 'string' }
};

const tools: Tool[] = [
  {
    name: 'pirsch_list_domains',
    description: 'List accessible Pirsch domains to discover domain IDs',
    inputSchema: { type: 'object', properties: { search: { type: 'string' } } }
  },
  {
    name: 'pirsch_overview',
    description: 'Get cached overview (visitors, views, members) for a domain',
    inputSchema: { type: 'object', properties: { domain_id: { type: 'string' } } }
  },
  {
    name: 'pirsch_total',
    description: 'Get totals for visitors, views, sessions, bounces, bounce_rate, cr with filters',
    inputSchema: {
      type: 'object',
      properties: {
        domain_id: { type: 'string' },
        filter: { type: 'object', properties: filterSchemaProperties }
      }
    }
  },
  {
    name: 'pirsch_visitors',
    description: 'Get visitors time series with optional scale and filters',
    inputSchema: {
      type: 'object',
      properties: {
        domain_id: { type: 'string' },
        filter: { type: 'object', properties: filterSchemaProperties }
      }
    }
  },
  {
    name: 'pirsch_pages',
    description: 'Get page stats with sorting, search, and optional average time on page',
    inputSchema: {
      type: 'object',
      properties: {
        domain_id: { type: 'string' },
        filter: { type: 'object', properties: filterSchemaProperties }
      }
    }
  },
  {
    name: 'pirsch_referrers',
    description: 'Get referrer statistics with filters and sorting',
    inputSchema: { type: 'object', properties: { domain_id: { type: 'string' }, filter: { type: 'object', properties: filterSchemaProperties } } }
  },
  {
    name: 'pirsch_utm',
    description: 'Get UTM stats by dimension (source, medium, campaign, content, term)',
    inputSchema: {
      type: 'object',
      properties: {
        domain_id: { type: 'string' },
        type: { type: 'string', enum: ['source','medium','campaign','content','term'] },
        filter: { type: 'object', properties: filterSchemaProperties }
      },
      required: ['type']
    }
  },
  {
    name: 'pirsch_growth',
    description: 'Get growth rates across core metrics for the selected period',
    inputSchema: { type: 'object', properties: { domain_id: { type: 'string' }, filter: { type: 'object', properties: filterSchemaProperties } } }
  },
  {
    name: 'pirsch_active',
    description: 'Get active visitors and pages for the past N seconds (default 600)',
    inputSchema: { type: 'object', properties: { domain_id: { type: 'string' }, start: { type: 'number' } } }
  },
  {
    name: 'pirsch_compare',
    description: 'Compare visitors time series between two periods and return deltas/growth',
    inputSchema: {
      type: 'object',
      properties: {
        domain_id: { type: 'string' },
        period: { type: 'string', enum: ['today','yesterday','week','lastWeek','month','lastMonth'] },
        compare: { type: 'string', enum: ['previous','year','custom'], description: 'Compare to previous period, same period last year, or custom range' },
        from: { type: 'string' },
        to: { type: 'string' },
        compare_from: { type: 'string' },
        compare_to: { type: 'string' },
        scale: { type: 'string', enum: ['day','week','month','year'] }
      }
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    switch (name) {
      case 'pirsch_list_domains': {
        const search = args?.search as string | undefined;
        const res = await api.listDomains(search ? { search } : undefined);
        const arr = Array.isArray(res) ? res : [res];
        return { content: [{ type: 'text', text: JSON.stringify({ count: arr.length, domains: arr }, null, 2) }] };
      }
      case 'pirsch_overview': {
        const domainId = await resolveDomainId(args?.domain_id as string | undefined);
        const data = await api.getOverview(domainId);
        return { content: [{ type: 'text', text: JSON.stringify({ domain_id: domainId, overview: data }, null, 2) }] };
      }
      case 'pirsch_total': {
        const domainId = await resolveDomainId(args?.domain_id as string | undefined);
        const filter = (args?.filter || {}) as FilterInput;
        const data = await api.getStatistics('/statistics/total', domainId, filter);
        return { content: [{ type: 'text', text: JSON.stringify({ domain_id: domainId, total: data }, null, 2) }] };
      }
      case 'pirsch_visitors': {
        const domainId = await resolveDomainId(args?.domain_id as string | undefined);
        const filter = (args?.filter || {}) as FilterInput;
        const data = await api.getStatistics('/statistics/visitor', domainId, filter);
        return { content: [{ type: 'text', text: JSON.stringify({ domain_id: domainId, series: data }, null, 2) }] };
      }
      case 'pirsch_pages': {
        const domainId = await resolveDomainId(args?.domain_id as string | undefined);
        const filter = (args?.filter || {}) as FilterInput;
        const data = await api.getStatistics('/statistics/page', domainId, filter);
        return { content: [{ type: 'text', text: JSON.stringify({ domain_id: domainId, pages: data }, null, 2) }] };
      }
      case 'pirsch_referrers': {
        const domainId = await resolveDomainId(args?.domain_id as string | undefined);
        const filter = (args?.filter || {}) as FilterInput;
        const data = await api.getStatistics('/statistics/referrer', domainId, filter);
        return { content: [{ type: 'text', text: JSON.stringify({ domain_id: domainId, referrers: data }, null, 2) }] };
      }
      case 'pirsch_utm': {
        const domainId = await resolveDomainId(args?.domain_id as string | undefined);
        const filter = (args?.filter || {}) as FilterInput;
        const type = args?.type as string;
        const endpoint = `/statistics/utm/${type}`;
        const data = await api.getStatistics(endpoint, domainId, filter);
        return { content: [{ type: 'text', text: JSON.stringify({ domain_id: domainId, type, utm: data }, null, 2) }] };
      }
      case 'pirsch_growth': {
        const domainId = await resolveDomainId(args?.domain_id as string | undefined);
        const filter = (args?.filter || {}) as FilterInput;
        const data = await api.getStatistics('/statistics/growth', domainId, filter);
        return { content: [{ type: 'text', text: JSON.stringify({ domain_id: domainId, growth: data }, null, 2) }] };
      }
      case 'pirsch_active': {
        const domainId = await resolveDomainId(args?.domain_id as string | undefined);
        const start = (args?.start as number) ?? 600;
        const data = await api.getActive(domainId, start);
        return { content: [{ type: 'text', text: JSON.stringify({ domain_id: domainId, start, active: data }, null, 2) }] };
      }
      case 'pirsch_compare': {
        const domainId = await resolveDomainId(args?.domain_id as string | undefined);
        const scale = (args?.scale as 'day'|'week'|'month'|'year') || 'day';

        // Determine ranges
        let currentFrom: string, currentTo: string, previousFrom: string, previousTo: string;
        if (args?.period) {
          const range = getDateRange(args.period as 'today'|'yesterday'|'week'|'lastWeek'|'month'|'lastMonth');
          currentFrom = isoDate(range.start);
          currentTo = isoDate(range.end);
          if (args?.compare === 'year') {
            const prevStart = new Date(range.start);
            const prevEnd = new Date(range.end);
            prevStart.setFullYear(prevStart.getFullYear() - 1);
            prevEnd.setFullYear(prevEnd.getFullYear() - 1);
            previousFrom = isoDate(prevStart);
            previousTo = isoDate(prevEnd);
          } else { // previous by same length
            const lenDays = Math.ceil((range.end.getTime() - range.start.getTime()) / (1000*60*60*24)) + 1;
            const prevEnd = new Date(range.start);
            prevEnd.setDate(prevEnd.getDate() - 1);
            const prevStart = new Date(prevEnd);
            prevStart.setDate(prevEnd.getDate() - (lenDays - 1));
            previousFrom = isoDate(prevStart);
            previousTo = isoDate(prevEnd);
          }
        } else if (args?.compare === 'custom' && args?.from && args?.to && args?.compare_from && args?.compare_to) {
          currentFrom = args.from as string; currentTo = args.to as string;
          previousFrom = args.compare_from as string; previousTo = args.compare_to as string;
        } else {
          throw new Error('Provide either period or custom from/to + compare_from/compare_to');
        }

        // Fetch both series
        const [curr, prev] = await Promise.all([
          api.getStatistics('/statistics/visitor', domainId, { from: currentFrom, to: currentTo, scale }),
          api.getStatistics('/statistics/visitor', domainId, { from: previousFrom, to: previousTo, scale })
        ]);

        const currTotals = sumSeries(curr as VisitorsPoint[]);
        const prevTotals = sumSeries(prev as VisitorsPoint[]);
        const result = {
          period: { from: currentFrom, to: currentTo },
          compare_to: { from: previousFrom, to: previousTo },
          totals: {
            visitors: { current: currTotals.visitors, previous: prevTotals.visitors, change: pctChange(currTotals.visitors, prevTotals.visitors) },
            views: { current: currTotals.views, previous: prevTotals.views, change: pctChange(currTotals.views, prevTotals.views) },
            sessions: { current: currTotals.sessions, previous: prevTotals.sessions, change: pctChange(currTotals.sessions, prevTotals.sessions) },
            bounces: { current: currTotals.bounces, previous: prevTotals.bounces, change: pctChange(currTotals.bounces, prevTotals.bounces) }
          },
          series: { current: curr, previous: prev }
        };

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: true, message: err.message || 'An error occurred' }, null, 2) }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Pirsch MCP server running');
}

main().catch((e) => {
  console.error('Server error:', e);
  process.exit(1);
});
