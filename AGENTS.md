# AGENTS.md

This file provides guidance to coding agents (Claude Code, Cursor, Codex, and others) when working with code in this repository. `CLAUDE.md` imports this file via `@AGENTS.md`, so this is the single source of truth for agent direction.

## Project Overview

MCP Pirsch Server - A Model Context Protocol server that provides analytics tools for Pirsch Analytics. It enables natural language queries, comparisons, and trend analysis of website traffic through an MCP interface. The server speaks MCP over stdio (`src/index.ts:1`).

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript (dist/) — runs clean prebuild + chmod postbuild
npm run build

# Development mode with auto-reload (tsx watch)
npm run dev

# Start production server (node dist/index.js)
npm start

# Run the test suite (Vitest, single run)
npm test

# Watch-mode tests / coverage
npm run test:watch
npm run test:coverage

# Type-check without emitting, lint, and format
npm run typecheck
npm run lint
npm run format
```

## Architecture

### Core Components

- **src/index.ts**: MCP server implementation. Registers the tool list, wires `ListToolsRequestSchema`/`CallToolRequestSchema` handlers, resolves domain IDs, and implements the compare tool.
- **src/pirsch-api.ts**: `PirschAPI` client with token caching, auto-refresh, and retry/backoff (`src/pirsch-api.ts:19`).
- **src/filters.ts**: `buildFilterParams()` builds URL parameters from filter objects for API queries (`src/filters.ts:3`).
- **src/types.ts**: TypeScript interfaces for Pirsch data structures.
- **src/utils.ts**: Date range helpers (`getDateRange`, `isoDate`) and series aggregation (`sumSeries`, `pctChange`).

Each source module has a colocated `*.test.ts` (`src/index.test.ts`, `src/pirsch-api.test.ts`, `src/filters.test.ts`, `src/utils.test.ts`) run by Vitest (`vitest.config.ts`).

### Token Management

The `PirschAPI` class implements token caching:
- Tokens are cached with expiration tracking; validity is checked against a configurable skew (`src/pirsch-api.ts:31`).
- Refreshes when the token expires within `PIRSCH_TOKEN_SKEW_MS` (default 60000 ms — `src/pirsch-api.ts:28`).
- Handles 401 responses with an automatic token refresh and retry (`src/pirsch-api.ts:93`).
- Rate limiting: 429 responses respect the `Retry-After` header before retrying (`src/pirsch-api.ts:99`).

### MCP Tools Pattern

Most tools follow this structure:
1. Resolve domain ID via `resolveDomainId()` — from args, `PIRSCH_DEFAULT_DOMAIN_ID`, or auto-detect by listing domains (`src/index.ts:349`).
2. Build filter parameters using `buildFilterParams()`.
3. Call the appropriate `PirschAPI` method / endpoint.
4. Return a formatted response.

## MCP Tools

The server registers **17 tools** (assembled into the `tools` array at `src/index.ts:507`):

| Tool | Purpose |
| --- | --- |
| `pirsch_list_domains` | List accessible Pirsch domains to discover domain IDs |
| `pirsch_overview` | Cached overview statistics for a domain (filters do not apply) |
| `pirsch_total` | Totals for visitors, views, sessions, bounces, bounce_rate, cr, custom metrics |
| `pirsch_visitors` | Visitors time series with optional scale |
| `pirsch_pages` | Page stats with sorting, search, optional avg time on page |
| `pirsch_entry_pages` | Entry page stats |
| `pirsch_exit_pages` | Exit page stats |
| `pirsch_referrers` | Referrer stats |
| `pirsch_goals` | Goal/conversion stats |
| `pirsch_events` | Event stats |
| `pirsch_event_pages` | Pages for a given event |
| `pirsch_growth` | Growth rates across core metrics for the period |
| `pirsch_sessions` | Session stats |
| `pirsch_session_details` | Session detail / page-flow lookups |
| `pirsch_utm` | UTM stats by dimension (source, medium, campaign, content, term) |
| `pirsch_active` | Active visitors and pages for the past N seconds (default 600) |
| `pirsch_compare` | Compare totals and visitor series between two periods |

Twelve of these (`pirsch_total` … `pirsch_session_details`) are generated from `statisticsToolConfigs` (`src/index.ts:419`); the rest are declared explicitly. When adding a statistics-style tool, add a config entry there; for a bespoke tool, add it directly to the `tools` array and a handler branch in the `CallToolRequestSchema` handler (`src/index.ts:561`).

## Environment Configuration

Required environment variables (read in `src/index.ts:12`):
- `PIRSCH_CLIENT_ID`: OAuth client ID from Pirsch
- `PIRSCH_CLIENT_SECRET`: OAuth client secret from Pirsch

Optional:
- `PIRSCH_DEFAULT_DOMAIN_ID`: Default domain to query (auto-detects first domain if not set — `src/index.ts:14`)
- `PIRSCH_TIMEZONE`: Default timezone passed to filter params (e.g. 'Europe/Berlin' — `src/pirsch-api.ts:140`)
- `PIRSCH_TOKEN_SKEW_MS`: Token refresh buffer in ms (default 60000 — `src/pirsch-api.ts:28`)

See `.env.example` for the canonical list.

## Testing the MCP Server

### Unit / integration tests
```bash
npm test          # vitest run
npm run test:watch
```

### Local manual testing
```bash
# Provide credentials and run the server (stdio transport)
PIRSCH_CLIENT_ID=xxx PIRSCH_CLIENT_SECRET=yyy npm run dev

# The server speaks stdio, so exercising tools requires an MCP client.
```

### Integration with an MCP client
1. Build the project: `npm run build`
2. Register the server (e.g. `claude mcp add pirsch "npx @verygoodplugins/mcp-pirsch"`) or add it to `.mcp.json` / Claude Desktop config (see README).
3. Restart the MCP client to load the server.
4. Call `pirsch_list_domains` to verify the connection.

## Key Implementation Details

### Filter System
All statistics endpoints accept a filter object that maps to Pirsch API query parameters. `buildFilterParams()` (`src/filters.ts:3`) handles:
- Date/time ranges with timezone support
- Dimensions (path, referrer, browser, OS, etc.)
- UTM parameters
- Pagination and sorting
- Custom metrics and tags

Page-style tools additionally support an MCP-local `path_prefix` filter (`supportsLocalPathPrefix` in `statisticsToolConfigs`), normalized via `normalizePathPrefix()` (`src/index.ts:133`).

### Comparison Logic
The `pirsch_compare` tool computes true period comparisons (`src/index.ts:320`):
1. Fetches current and previous period totals directly from `/statistics/total`.
2. Fetches current and previous visitor series from `/statistics/visitor`.
3. Builds per-metric deltas with `buildComparisonTotals()` / `compareMetric()`, using `pctChange()` for percentage change (`src/index.ts:252`, `src/index.ts:256`).
4. Returns both visitor series plus the computed totals/deltas.

(`sumSeries()` in `src/utils.ts` aggregates a visitor series and is unit-tested, but the compare tool relies on the `/statistics/total` endpoint for totals rather than summing the series.)

### Error Handling
- Network/transient errors are retried with backoff in the request loop (`src/pirsch-api.ts:93`).
- 401 errors trigger a token refresh and retry.
- 429 rate limits respect `Retry-After` before retrying.
- Domain resolution throws a helpful error when no domain can be determined (`src/index.ts:355`).
