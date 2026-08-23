# Pirsch MCP 1.0 modernization

## Goal

Turn `@verygoodplugins/mcp-pirsch` into a current, differentiated, read-only
Pirsch Analytics MCP server. It will support the 2026-07-28 MCP protocol and
the complete useful Pirsch API v1 analytics surface while keeping its
period-comparison and session-investigation advantages.

## Public API

Version 1.0 replaces the current 17-tool catalog with four model-friendly,
read-only tools:

1. `pirsch_list_domains` returns only the safe fields needed to choose a
   domain: ID, hostname, display name, and timezone.
2. `pirsch_query_statistics` takes an explicit metric and validated filter,
   covering documented v1 read endpoints, including overview, traffic,
   acquisition, event, device, geography, tags, funnels, and session data.
3. `pirsch_list_filter_options` discovers valid filter values for a date range.
4. `pirsch_compare_periods` retains the existing true-total comparison and
   series output.

Statistics requests use `PIRSCH_DEFAULT_DOMAIN_ID` when set. Without it,
requests must include a domain ID; the server must never silently select the
first account-scoped domain. Existing `pirsch_*` tool names are removed in 1.0
and mapped in the migration guide; no legacy aliases are enabled by default.

## Implementation

- Migrate from `@modelcontextprotocol/sdk` v1 to
  `@modelcontextprotocol/server` v2 and `serveStdio`, targeting MCP
  2026-07-28 while retaining legacy-client compatibility provided by the SDK.
- Use Zod v4 input/output schemas, structured content plus JSON text fallback,
  readable titles, and read-only tool annotations. Tool errors return
  `isError: true`.
- Keep a single native-`fetch` Pirsch API v1 client. It owns token caching,
  concurrent refresh deduplication, timeout, retry-after handling, response
  validation, and redacted error messages. Credentials are validated lazily so
  discovery works without secrets.
- Make a direct stdio entry point and an importable server factory so symlinked
  npm/npx execution needs no entrypoint guard. Preserve tested lifecycle
  behavior that prevents orphaned stdio processes.
- Require Node.js 22.19 or newer; remove `node-fetch` and the vulnerable
  monolithic MCP v1 SDK.

## Delivery and propagation

- Update package metadata, README, `.env.example`, registry manifest, CI,
  security checks, and release automation. Registry publication runs only after
  the npm package has published successfully and uses GitHub OIDC.
- Release as 1.0 with a migration section and a current Codex configuration
  example. Do not publish or create a pull request during this implementation;
  those remain post-review release actions.
- Feed reusable findings into `../mcp-ecosystem`: strengthen the TypeScript
  standard/audit for v2 structured tool results, tool safety annotations,
  lazy credential validation, safe discovery responses, and registry-version
  publication verification. Use the existing modern template baseline rather
  than duplicating its already-landed SDK v2 and OIDC work.

## Validation

- Unit-test filter translation, validation, token refresh/retry/timeout, safe
  domain projection, metric routing, and comparison calculations.
- Add MCP client tests for tool discovery, structured results, errors, and
  legacy/2026 protocol negotiation; keep an Inspector CLI smoke test for a
  built npm-style entry point.
- Run the full local quality gate, package dry-run, registry validation, and
  a safe live read-only Pirsch smoke test when credentials are available.
