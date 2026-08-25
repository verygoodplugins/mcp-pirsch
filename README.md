# Pirsch MCP Server

[![npm](https://img.shields.io/npm/v/@verygoodplugins/mcp-pirsch)](https://www.npmjs.com/package/@verygoodplugins/mcp-pirsch)

A focused, read-only [Model Context Protocol](https://modelcontextprotocol.io) server for [Pirsch Analytics API v1](https://docs.pirsch.io/api-sdks/api-v1). It uses MCP SDK v2 and returns both structured results and JSON text for every successful tool call.

## Requirements

- Node.js **22.19.0 or later**
- A Pirsch OAuth API client with read access. Do not use a write-only access key.

## Configure

```json
{
  "mcpServers": {
    "pirsch": {
      "command": "npx",
      "args": ["-y", "@verygoodplugins/mcp-pirsch@latest"],
      "env": {
        "PIRSCH_CLIENT_ID": "your-read-only-oauth-client-id",
        "PIRSCH_CLIENT_SECRET": "your-oauth-client-secret",
        "PIRSCH_DEFAULT_DOMAIN_ID": "optional-default-domain-id"
      }
    }
  }
}
```

`PIRSCH_DEFAULT_DOMAIN_ID` is optional. When it is unset, every query tool requires `domainId`; the server never picks the first accessible domain. Use `pirsch_list_domains` to discover IDs safely.

Optional `PIRSCH_TIMEZONE` supplies the default timezone for requests that do not explicitly include `timezone`.

## Tools

| Tool | Purpose |
| --- | --- |
| `pirsch_list_domains` | Lists only `id`, hostname, display name, and timezone. |
| `pirsch_query_statistics` | Reads one documented v1 metric, with dates and filters. |
| `pirsch_list_filter_options` | Lists allowed values for a documented filter dimension. |
| `pirsch_compare_periods` | Compares actual totals and visitor series for two periods. |

All tools are read-only. They return `structuredContent` matching their output schema as well as an equivalent JSON text block. Input or API failures use MCP `isError: true` and do not expose credentials or raw upstream bodies.

### Querying statistics

`pirsch_query_statistics` accepts a `metric`, optional `domainId`, and flat camel-case filters. Most metrics require ISO dates:

```json
{
  "metric": "pages",
  "domainId": "your-domain-id",
  "from": "2026-08-01",
  "to": "2026-08-23",
  "limit": 20,
  "sort": "visitors",
  "direction": "desc"
}
```

The server maps public camel-case fields such as `eventMetaKey`, `entryPath`, `operatingSystem`, and `utmCampaign` to Pirsch's documented API-v1 parameter names. `limit` is constrained to 1–100 and active visitor `start` to 0–3600 seconds.

Metrics include totals, visitors, pages and entry/exit pages, session and page duration, goals, events and event metadata, growth, active visitors, time breakdowns, acquisition, browser/device, geographic, UTM, tags, keywords, funnels, sessions, and session details. `session_details` requires both `visitorId` and `sessionId`; event-specific metrics require `event`.

### Comparing periods

Provide a named `period` (`today`, `yesterday`, `week`, `lastWeek`, `month`, or `lastMonth`) or both explicit date pairs:

```json
{
  "domainId": "your-domain-id",
  "from": "2026-08-01",
  "to": "2026-08-07",
  "compareFrom": "2026-07-25",
  "compareTo": "2026-07-31",
  "scale": "day"
}
```

The response compares `/statistics/total` and retains the two `/statistics/visitor` series; it does not estimate totals by summing charts.

## 1.0 migration

Version 1.0 intentionally replaces the former 17-tool interface. There are no default aliases because aliases would keep unsafe domain-selection and ambiguous input behavior alive.

| Previous tools | Replacement |
| --- | --- |
| `pirsch_overview`, `pirsch_total`, `pirsch_pages`, `pirsch_events`, and other statistic tools | `pirsch_query_statistics` with `metric` |
| `pirsch_utm` | `pirsch_query_statistics` with one of the `utm_*` metrics |
| `pirsch_compare` | `pirsch_compare_periods` |
| Domain discovery | `pirsch_list_domains` |

Input names are now camel-case and flat (`domainId`, `compareFrom`, `eventMetaKey`), not `domain_id`, nested `filter`, or compatibility aliases.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npx -y @modelcontextprotocol/inspector@latest --cli node dist/index.js --method tools/list --format json
```

The release workflow publishes to npm with trusted publishing and then publishes the same tagged manifest to the MCP Registry through GitHub OIDC. Local development and CI never publish anything.

## Support

For bugs and feature requests, open an issue in this repository. Pirsch questions are best answered through the [Pirsch documentation](https://docs.pirsch.io/api-sdks/api-v1); package support is maintained by [Very Good Plugins](https://verygoodplugins.com/?utm_source=github).

Built with 🧡 by Very Good Plugins.
