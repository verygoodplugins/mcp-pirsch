# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Pirsch Server - A Model Context Protocol server that provides analytics tools for Pirsch Analytics. It enables natural language queries, comparisons, and trend analysis of website traffic through an MCP interface.

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript (dist/)
npm run build

# Development mode with auto-reload
npm run dev

# Start production server
npm start

# Quick test (runs help command)
npm test
```

## Architecture

### Core Components

- **src/index.ts**: MCP server implementation that registers tools and handles requests
- **src/pirsch-api.ts**: Pirsch API client with token caching and auto-refresh
- **src/filters.ts**: Builds URL parameters from filter objects for API queries
- **src/types.ts**: TypeScript interfaces for Pirsch data structures
- **src/utils.ts**: Date range helpers and data aggregation utilities

### Token Management

The PirschAPI class implements intelligent token caching:
- Tokens are cached with expiration tracking
- Auto-refreshes 60 seconds before expiry (configurable via PIRSCH_TOKEN_SKEW_MS)
- Handles 401 errors with automatic retry after refresh
- Rate limiting with exponential backoff for 429 responses

### MCP Tools Pattern

Each tool follows this structure:
1. Resolve domain ID (from args, env, or auto-detect)
2. Build filter parameters using buildFilterParams()
3. Call appropriate PirschAPI method
4. Return formatted response

## Environment Configuration

Required environment variables:
- `PIRSCH_CLIENT_ID`: OAuth client ID from Pirsch
- `PIRSCH_CLIENT_SECRET`: OAuth client secret from Pirsch

Optional:
- `PIRSCH_DEFAULT_DOMAIN_ID`: Default domain to query (auto-detects if not set)
- `PIRSCH_TIMEZONE`: Default timezone for queries (e.g., 'Europe/Berlin')
- `PIRSCH_TOKEN_SKEW_MS`: Token refresh buffer in ms (default: 60000)

## Testing the MCP Server

### Local Testing
```bash
# Test with environment variables
PIRSCH_CLIENT_ID=xxx PIRSCH_CLIENT_SECRET=yyy npm run dev

# The server expects stdio transport, so testing requires an MCP client
```

### Integration Testing
1. Build the project: `npm run build`
2. Configure in `.mcp.json` or Claude Desktop config
3. Restart the MCP client to load the server
4. Test tools like `pirsch_list_domains` to verify connection

## Key Implementation Details

### Filter System
All statistics endpoints accept a FilterInput object that maps directly to Pirsch API query parameters. The buildFilterParams() function handles:
- Date/time ranges with timezone support
- Dimensions (path, referrer, browser, OS, etc.)
- UTM parameters
- Pagination and sorting
- Custom metrics and tags

### Comparison Logic
The `pirsch_compare` tool implements period comparison by:
1. Fetching two visitor series (current and comparison period)
2. Computing totals using sumSeries()
3. Calculating percentage changes with pctChange()
4. Returning both series and delta metrics

### Error Handling
- Network errors trigger retries with backoff
- 401 errors trigger token refresh
- 429 rate limits respect Retry-After headers
- Domain resolution fails gracefully with helpful messages