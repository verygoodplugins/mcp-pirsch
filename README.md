# MCP Pirsch Server

[![Version](https://img.shields.io/npm/v/@verygoodplugins/mcp-pirsch)](https://www.npmjs.com/package/@verygoodplugins/mcp-pirsch)
[![License](https://img.shields.io/npm/l/@verygoodplugins/mcp-pirsch)](LICENSE)

A Model Context Protocol (MCP) server for Pirsch Analytics, enabling natural language analytics queries, period comparisons, and trend analysis for your website traffic.

## Features

- 🔐 **Smart Authentication** - OAuth client credentials with automatic token caching and refresh
- 📊 **Core Analytics** - Comprehensive stats including visitors, page views, bounce rates, and conversion rates
- 📈 **Time Series Data** - Flexible visitor trends with day/week/month/year granularity
- 🔄 **Period Comparisons** - Compare metrics across different time periods with calculated deltas
- ⚡ **Real-time Insights** - Active visitor tracking with configurable time windows
- 🎯 **Advanced Filtering** - Full support for Pirsch query parameters including UTM, referrers, and dimensions
- 🌍 **Multi-domain Support** - Manage analytics across multiple websites from one interface

## Quick Start

### Installation Methods

#### Option 1: Using NPX (No Installation Required)

The simplest way - no need to install anything globally:

```bash
# For Claude Desktop
npx @verygoodplugins/mcp-pirsch

# For Claude Code
claude mcp add pirsch "npx @verygoodplugins/mcp-pirsch"
```

#### Option 2: Global Installation

Install once, use anywhere:

```bash
# Install globally
npm install -g @verygoodplugins/mcp-pirsch

# For Claude Code
claude mcp add pirsch "mcp-pirsch"
```

#### Option 3: Local Development

For contributing or customization:

```bash
# Clone and install
git clone https://github.com/verygoodplugins/mcp-pirsch.git
cd mcp-pirsch
npm install
npm run build
```

## Configuration

### 1. Get Pirsch API Credentials

1. Log into your [Pirsch Analytics Dashboard](https://pirsch.io)
2. Navigate to Settings → API Clients
3. Create a new client with appropriate permissions
4. Copy your Client ID and Client Secret

### 2. Configure Your Client

<details>
<summary><b>Claude Desktop Configuration</b></summary>

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pirsch": {
      "command": "npx",
      "args": ["@verygoodplugins/mcp-pirsch"],
      "env": {
        "PIRSCH_CLIENT_ID": "your_client_id",
        "PIRSCH_CLIENT_SECRET": "your_client_secret",
        "PIRSCH_DEFAULT_DOMAIN_ID": "your_domain_id",
        "PIRSCH_TIMEZONE": "America/New_York"
      }
    }
  }
}
```

**Or** if installed globally:
```json
{
  "mcpServers": {
    "pirsch": {
      "command": "mcp-pirsch",
      "env": {
        "PIRSCH_CLIENT_ID": "your_client_id",
        "PIRSCH_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Claude Code Configuration</b></summary>

```bash
claude mcp add pirsch "npx @verygoodplugins/mcp-pirsch" \
  --env PIRSCH_CLIENT_ID=your_client_id \
  --env PIRSCH_CLIENT_SECRET=your_client_secret \
  --env PIRSCH_DEFAULT_DOMAIN_ID=your_domain_id
```

</details>

<details>
<summary><b>Cursor IDE Configuration</b></summary>

Add to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "pirsch": {
      "command": "node",
      "args": ["./node_modules/@verygoodplugins/mcp-pirsch/dist/index.js"],
      "env": {
        "PIRSCH_CLIENT_ID": "your_client_id",
        "PIRSCH_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

</details>

### 3. Environment Variables

Create a `.env` file for local development:

```env
# Required
PIRSCH_CLIENT_ID=your_client_id
PIRSCH_CLIENT_SECRET=your_client_secret

# Optional
PIRSCH_DEFAULT_DOMAIN_ID=your_domain_id  # Auto-detected if not set
PIRSCH_TIMEZONE=America/New_York         # Default: UTC
PIRSCH_TOKEN_SKEW_MS=60000              # Token refresh buffer (default: 60 seconds)
```

## Available Tools

### Discovery & Setup

#### `pirsch_list_domains`
List all accessible domains to discover domain IDs.

**Parameters:**
- `search` (optional): Filter domains by name

**Example:**
```
List all my Pirsch domains
```

### Core Statistics

#### `pirsch_overview`
Get cached overview statistics for a domain.

**Parameters:**
- `domain_id` (optional): Target domain ID

**Returns:** Visitors, page views, and member counts

#### `pirsch_total`
Get total metrics for a specific period.

**Parameters:**
- `domain_id` (optional): Target domain ID
- `filter` (optional): Filter object with date range, dimensions, etc.

**Returns:** Total visitors, views, sessions, bounces, bounce rate, conversion rate

#### `pirsch_visitors`
Get visitor time series data.

**Parameters:**
- `domain_id` (optional): Target domain ID
- `filter` (optional): Including `scale` (day/week/month/year)

**Example:**
```
Show me daily visitor trends for the last month
```

#### `pirsch_pages`
Get top pages with performance metrics.

**Parameters:**
- `domain_id` (optional): Target domain ID
- `filter` (optional): Including:
  - `sort`: Sort field
  - `direction`: asc/desc
  - `search`: Search in page paths
  - `include_avg_time_on_page`: Include time metrics
  - `include_title`: Include page titles

#### `pirsch_referrers`
Analyze traffic sources and referrers.

**Parameters:**
- `domain_id` (optional): Target domain ID
- `filter` (optional): Standard filter parameters

#### `pirsch_utm`
Analyze UTM campaign parameters.

**Parameters:**
- `type` (required): source | medium | campaign | content | term
- `domain_id` (optional): Target domain ID
- `filter` (optional): Standard filter parameters

**Example:**
```
Show me UTM source breakdown for this week
```

#### `pirsch_growth`
Calculate growth rates across metrics.

**Parameters:**
- `domain_id` (optional): Target domain ID
- `filter` (optional): Date range for growth calculation

### Real-time Analytics

#### `pirsch_active`
Get currently active visitors and pages.

**Parameters:**
- `domain_id` (optional): Target domain ID
- `start` (optional): Seconds to look back (default: 600)

**Example:**
```
Show me active visitors in the last 5 minutes
```

### Comparative Analytics

#### `pirsch_compare`
Compare metrics between two time periods.

**Parameters:**
- `domain_id` (optional): Target domain ID
- `period` (optional): today | yesterday | week | lastWeek | month | lastMonth
- `compare` (optional): previous | year | custom
- `from`, `to` (optional): Custom date range (YYYY-MM-DD)
- `compare_from`, `compare_to` (optional): Custom comparison range
- `scale` (optional): day | week | month | year

**Example:**
```
Compare this week's traffic to last week
```

## Filter Parameters

Most tools accept a `filter` object that maps to Pirsch query parameters:

```javascript
{
  // Date/Time
  "from": "2024-01-01",        // Start date (YYYY-MM-DD)
  "to": "2024-01-31",          // End date (YYYY-MM-DD)
  "from_time": "09:00",        // Start time (HH:MM)
  "to_time": "17:00",          // End time (HH:MM)
  "tz": "America/New_York",    // Timezone
  
  // Dimensions
  "path": "/blog/*",           // Page path pattern
  "entry_path": "/landing",    // Entry page
  "exit_path": "/checkout",    // Exit page
  "pattern": "*.pdf",          // URL pattern
  
  // Traffic Sources
  "referrer": "google.com",    // Referrer domain
  "referrer_name": "Google",   // Referrer name
  "channel": "organic",        // Traffic channel
  
  // UTM Parameters
  "utm_source": "newsletter",
  "utm_medium": "email",
  "utm_campaign": "summer-sale",
  "utm_content": "header-cta",
  "utm_term": "analytics",
  
  // Device/Browser
  "os": "Windows",
  "browser": "Chrome",
  "platform": "desktop",       // desktop | mobile | unknown
  "screen_class": "xxl",
  
  // Location
  "country": "US",
  "city": "New York",
  "language": "en",
  
  // Pagination/Sorting
  "offset": 0,
  "limit": 100,
  "sort": "visitors",
  "direction": "desc",         // asc | desc
  "search": "blog",
  
  // Advanced
  "event": "signup",
  "event_meta_key": "plan",
  "tag": "premium",
  "custom_metric_key": "revenue",
  "custom_metric_type": "float"
}
```

## Usage Examples

### Basic Analytics Query
```
Show me the visitor statistics for last week
```

### Page Performance Analysis
```
What are my top 10 pages by traffic this month?
```

### Campaign Tracking
```
Analyze UTM campaign performance for the summer sale
```

### Traffic Sources
```
Show me referrer breakdown excluding direct traffic
```

### Period Comparison
```
Compare this month's metrics to the same period last year
```

### Real-time Monitoring
```
How many people are on my site right now?
```

## Development

### Building from Source

```bash
npm install
npm run build
```

### Development Mode

```bash
npm run dev  # Watch mode with auto-reload
```

### Testing

```bash
npm test
```

## Troubleshooting

### Authentication Issues

#### Invalid credentials error
- Verify your Client ID and Secret are correct
- Check that your API client has appropriate permissions in Pirsch
- Ensure credentials are properly set in environment variables

#### Token refresh failures
- The server automatically refreshes tokens 60 seconds before expiry
- Check network connectivity to Pirsch API
- Verify `PIRSCH_TOKEN_SKEW_MS` is not set too low

### Domain Issues

#### Domain not found
- Run `pirsch_list_domains` to see available domains
- Verify `PIRSCH_DEFAULT_DOMAIN_ID` is correct
- Check API client has access to the domain

#### No data returned
- Verify the date range contains data
- Check timezone settings match your Pirsch configuration
- Ensure proper filtering parameters

### Performance

#### Slow responses
- Token caching reduces authentication overhead
- Consider adjusting `PIRSCH_TOKEN_SKEW_MS` for your use case
- Check network latency to Pirsch API endpoints

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

MIT - See [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/verygoodplugins/mcp-pirsch/issues)
- **Documentation**: [Pirsch API Docs](https://docs.pirsch.io/api-sdks/api)

## Credits

Built by [Jack Arturo](https://github.com/jgarturo) and [Very Good Plugins](https://verygoodplugins.com)

- Powered by [Pirsch Analytics](https://pirsch.io)
- Built with [Model Context Protocol SDK](https://github.com/anthropics/model-context-protocol)
- Part of the [Very Good Plugins](https://verygoodplugins.com) MCP ecosystem