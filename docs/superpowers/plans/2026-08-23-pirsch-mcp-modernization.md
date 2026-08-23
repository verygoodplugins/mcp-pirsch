# Pirsch MCP 1.0 Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a lean, safe, MCP 2026-compatible Pirsch Analytics v1 server and turn its reusable lessons into ecosystem standards.

**Architecture:** Split the program into an importable MCP server factory, a focused native-fetch Pirsch v1 client, schema/metric definitions, and a direct stdio entry point. All retrievals are read-only, return structured content plus JSON text, and share one token-owning client.

**Tech Stack:** Node.js 22.19+, TypeScript, `@modelcontextprotocol/server` 2.0.0, Zod v4, native `fetch`, Vitest, MCP Inspector, `mcp-publisher` 1.8.1.

## Global Constraints

- Ship exactly four default tools: `pirsch_list_domains`, `pirsch_query_statistics`, `pirsch_list_filter_options`, and `pirsch_compare_periods`.
- Remain stdio-only and read-only; no Pirsch tracking or configuration write endpoint may be registered.
- Require Node.js `>=22.19.0` and remove `@modelcontextprotocol/sdk` v1 and `node-fetch`.
- Use MCP SDK v2 Zod schemas, structured content, JSON text fallback, titles, and read-only annotations.
- Use `PIRSCH_DEFAULT_DOMAIN_ID` or require `domainId`; never silently choose an account-scoped domain.
- Never return Pirsch credentials or excess domain/account metadata.
- Do not publish to npm, the MCP Registry, GitHub, or open/close pull requests.

---

### Task 1: Establish the v2 server seam and dependency baseline

**Files:**

- Create: `src/server.ts`, `src/server.test.ts`
- Modify: `src/index.ts`, `package.json`, `package-lock.json`

**Interfaces:** `createPirschServer(options?: PirschServerOptions): McpServer` is importable by tests; `src/index.ts` invokes `serveStdio(() => createPirschServer())`.

- [ ] **Step 1: Write the failing factory-seam test over the public MCP protocol.**

```ts
import { describe, expect, it } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createPirschServer } from './server.js';

describe('createPirschServer', () => {
  it('connects an empty factory before tool registration', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createPirschServer();
    await server.connect(serverTransport);
    const client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(clientTransport);
    expect((await client.listTools()).tools).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run `npx vitest run src/server.test.ts`; expect a missing-module failure.**

- [ ] **Step 3: Replace dependencies and add the minimal seam.**

```json
"engines": { "node": ">=22.19.0" },
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.29.0",
  "@modelcontextprotocol/server": "^2.0.0",
  "dotenv": "^17.4.2",
  "node-fetch": "^3.3.2",
  "zod": "^4.4.3"
}
```

Keep the legacy SDK and `node-fetch` in this transition commit because the legacy entry point and client still compile. Task 2 removes them together with their remaining callers.

```ts
// src/index.ts
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createPirschServer } from './server.js';
void serveStdio(() => createPirschServer());
console.error('Pirsch MCP server running on stdio');
```

- [ ] **Step 4: Run `npx vitest run src/server.test.ts && npm run build`; expect the factory seam to pass. The four-tool assertion belongs to Task 3, where registration is introduced.**
- [ ] **Step 5: Commit.**

```bash
git add package.json package-lock.json src/index.ts src/server.ts src/server.test.ts
git commit -m "refactor: establish MCP v2 server factory"
```

### Task 2: Build a hardened Pirsch v1 read client and metric registry

**Files:**

- Create: `src/pirsch-client.ts`, `src/pirsch-client.test.ts`, `src/metrics.ts`, `src/metrics.test.ts`
- Modify: `src/types.ts`, `src/filters.ts`, `src/filters.test.ts`
- Delete: `src/pirsch-api.ts`, `src/pirsch-api.test.ts`

**Interfaces:** `PirschClient.listDomains()` returns safe summaries; `PirschClient.get(endpoint, filter)` serves documented read endpoints; `statisticsMetrics` and `filterOptionMetrics` hold endpoint and input requirements.

- [ ] **Step 1: Write failing tests for concurrent token refresh, projected domains, redacted errors, retry-after, and encoded `eventMeta`/`tags`.**

```ts
it('shares an in-flight token refresh', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_at: futureIso() }))
    .mockResolvedValue(jsonResponse([]));
  const client = new PirschClient(credentials, { fetch });
  await Promise.all([client.listDomains(), client.listDomains()]);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('returns only safe domain fields', async () => {
  await expect(client.listDomains()).resolves.toEqual([
    { id: 'domain-1', hostname: 'example.com', displayName: 'Example', timezone: 'UTC' },
  ]);
});
```

- [ ] **Step 2: Run `npx vitest run src/pirsch-client.test.ts src/metrics.test.ts`; expect missing-module failures.**

- [ ] **Step 3: Implement native-fetch client behavior and complete metric maps.**

```ts
export const statisticsMetrics = {
  overview: { endpoint: '/statistics/overview', dateRange: 'forbidden' },
  total: { endpoint: '/statistics/total', dateRange: 'required' },
  visitors: { endpoint: '/statistics/visitor', dateRange: 'required' },
  pages: { endpoint: '/statistics/page', dateRange: 'required' },
  entry_pages: { endpoint: '/statistics/page/entry', dateRange: 'required' },
  exit_pages: { endpoint: '/statistics/page/exit', dateRange: 'required' },
  sessions: { endpoint: '/statistics/session/list', dateRange: 'required' },
  session_details: { endpoint: '/statistics/session/details', dateRange: 'optional', requires: ['visitorId', 'sessionId'] },
  // Include documented durations, UTM, event, acquisition, device, geography,
  // tag, keyword, funnel, hour, minute, weekday, growth, and active metrics.
} as const;
```

The client owns one refresh promise, `AbortSignal.timeout`, 401 refresh/retry, bounded 429 retry honoring numeric `Retry-After`, parsed redacted errors, and lazy credential validation. Add date, range, 1–100 limit, 0–3600 active-window, and session-ID validation in Zod-backed filter code.

- [ ] **Step 4: Run `npx vitest run src/pirsch-client.test.ts src/metrics.test.ts src/filters.test.ts && npm run typecheck`; expect pass.**
- [ ] **Step 5: Commit.**

```bash
git add src/pirsch-client.ts src/pirsch-client.test.ts src/metrics.ts src/metrics.test.ts src/types.ts src/filters.ts src/filters.test.ts
git rm src/pirsch-api.ts src/pirsch-api.test.ts
git commit -m "feat: add comprehensive Pirsch v1 read client"
```

### Task 3: Register the compact MCP API and structured results

**Files:**

- Modify: `src/server.ts`, `src/server.test.ts`
- Create: `src/mcp.test.ts`
- Delete: `src/index.test.ts`, `src/utils.ts`, `src/utils.test.ts`

**Interfaces:** `createPirschServer({ clientFactory, defaultDomainId })` permits injected clients. Successful calls return `content` and `structuredContent`; failures return text plus `isError: true`.

- [ ] **Step 1: Write failing in-memory MCP client tests.**

```ts
it('returns safe domains as structured content', async () => {
  const result = await client.callTool({ name: 'pirsch_list_domains', arguments: {} });
  expect(result.structuredContent).toEqual({
    domains: [{ id: 'domain-1', hostname: 'example.com', timezone: 'UTC' }],
  });
  expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
});

it('marks invalid input as an MCP error result', async () => {
  const result = await client.callTool({ name: 'pirsch_query_statistics', arguments: { metric: 'pages' } });
  expect(result.isError).toBe(true);
});
```

- [ ] **Step 2: Run `npx vitest run src/server.test.ts src/mcp.test.ts`; expect no registered-tool failure.**

- [ ] **Step 3: Register exact schemas and tool metadata.**

```ts
server.registerTool('pirsch_query_statistics', {
  title: 'Query Pirsch analytics',
  description: 'Read one documented Pirsch Analytics API v1 metric for a selected domain and filter.',
  inputSchema: statisticsQuerySchema,
  outputSchema: z.object({ domainId: z.string(), metric: z.string(), data: z.unknown() }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
}, async (input) => toToolResult(() => queryStatistics(client(), input, defaultDomainId)));
```

Apply matching title/output-schema/annotation rules to the other three tools. `pirsch_compare_periods` must call totals endpoints for totals and visitor endpoints for chart series. Delete the 17-tool dispatcher and first-domain fallback.

- [ ] **Step 4: Run `npm run build && npx vitest run src/server.test.ts src/mcp.test.ts && npx -y @modelcontextprotocol/inspector@latest --cli node dist/index.js --method tools/list --format json`; expect four tools and passing tests.**
- [ ] **Step 5: Commit.**

```bash
git add src/server.ts src/server.test.ts src/mcp.test.ts src/index.ts
git rm src/index.test.ts src/utils.ts src/utils.test.ts
git commit -m "feat!: replace legacy Pirsch tool catalog"
```

### Task 4: Make release and consumer surfaces 1.0-ready

**Files:**

- Modify: `README.md`, `.env.example`, `server.json`, `CLAUDE.md`, `src/index.spawn.test.ts`
- Create: `AGENTS.md`, `scripts/release-workflow.test.mjs`
- Modify: `.github/workflows/ci.yml`, `.github/workflows/security.yml`, `.github/workflows/release-please.yml`, `.github/dependabot.yml`, `release-please-config.json`, `.release-please-manifest.json`

**Interfaces:** Registry publication is downstream of npm publication and uses GitHub OIDC. The README maps each retired tool name to one of the four tools. The release hardening is delivered first by PR #35; this task consumes that verified baseline rather than duplicating it.

- [x] **Step 1: Keep the workflow assertion from the release-hardening slice.**

```js
test('registry publication follows npm publication and uses OIDC', () => {
  const workflow = readFileSync('.github/workflows/release-please.yml', 'utf8');
  assert.match(workflow, /needs: \[release-please, npm-publish\]/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /mcp-publisher login github-oidc/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});
```

- [x] **Step 2: Run `node --test scripts/release-workflow.node.mjs`; expect pass.**
- [ ] **Step 3: Document 1.0 and consume the existing release hardening.**

Use Node 22.19 and Node 24 in CI, and Node 24 for release; make dependency audit blocking. Add a post-npm MCP Registry job using pinned/checksummed `mcp-publisher` 1.8.1, `login github-oidc`, and `publish server.json`. Document Node 22.19+, OAuth read-only credentials, four-tool API, date/filter schemas, migration table, Codex config, and safe defaults. Create canonical `AGENTS.md`; reduce `CLAUDE.md` to a compatibility pointer. Add `server.json` environment-variable metadata and retain the `2025-12-11` schema.

- [ ] **Step 4: Restore direct and symlinked bin spawn coverage; then run the release test, build, package dry-run, and registry validation; expect pass.**

On a Linux runner, validate with the same pinned publisher binary used by the release workflow:

```bash
publisher_dir="$(mktemp -d)"
publisher_archive="$publisher_dir/mcp-publisher_linux_amd64.tar.gz"
curl --fail --location --show-error --silent --output "$publisher_archive" \
  "https://github.com/modelcontextprotocol/registry/releases/download/v1.8.1/mcp-publisher_linux_amd64.tar.gz"
printf '%s  %s\n' "a06c9096dcb9727c13555b6be26c7effa707b01f06a4c561ba7a3635443cf2cc" "$publisher_archive" | sha256sum --check --strict
tar -xzf "$publisher_archive" -C "$publisher_dir" mcp-publisher
"$publisher_dir/mcp-publisher" validate server.json
```
- [ ] **Step 5: Commit.**

```bash
git add README.md .env.example server.json .github package.json package-lock.json release-please-config.json .release-please-manifest.json CLAUDE.md AGENTS.md src/index.spawn.test.ts scripts/release-workflow.node.mjs
git commit -m "chore: prepare Pirsch MCP 1.0 delivery"
```

### Task 5: Propagate reusable safeguards into mcp-ecosystem

**Files:**

- Modify: `../mcp-ecosystem/STANDARDS.md`, `../mcp-ecosystem/README.md`, `../mcp-ecosystem/scripts/audit-server.sh`, `../mcp-ecosystem/scripts/tests/ecosystem-policy.test.mjs`

**Interfaces:** `audit-server.sh <repo>` identifies generic v2 structured-result and release-coupling findings, without Pirsch-specific rules.

- [ ] **Step 1: Write a failing ecosystem audit test.**

```js
test('audit reports missing v2 structured-result safeguards', () => {
  const output = runAudit(fixtureWithLegacySdkAndUnsafeToolResult);
  assert.match(output, /Legacy @modelcontextprotocol\/sdk detected/);
  assert.match(output, /structuredContent.*outputSchema/);
});
```

- [ ] **Step 2: Run `cd ../mcp-ecosystem && node --test scripts/tests/ecosystem-policy.test.mjs`; expect the new assertion to fail.**
- [ ] **Step 3: Add generic guidance and audit checks.**

Cover `McpServer`/`serveStdio`, output schema plus structured/text result parity, `isError`, read-only annotations, lazy secret validation, safe discovery projection, and registry publication only after package publication. Do not duplicate the ecosystem’s already-landed v2 dependency/OIDC template work.

- [ ] **Step 4: Run `cd ../mcp-ecosystem && node --test scripts/tests/ecosystem-policy.test.mjs && ./scripts/audit-server.sh ../mcp-pirsch`; expect passing tests and no Pirsch legacy-SDK/registry/stdout finding.**
- [ ] **Step 5: Commit in the ecosystem repository.**

```bash
git -C ../mcp-ecosystem add STANDARDS.md README.md scripts/audit-server.sh scripts/tests/ecosystem-policy.test.mjs
git -C ../mcp-ecosystem commit -m "feat: codify MCP v2 tool safety standards"
```

### Task 6: Verify the integrated result

**Files:** Modify only if verification exposes a defect.

- [ ] **Step 1: Run `npm run typecheck && npm run lint && npm test && npm run test:coverage && npm run build`; expect zero failures.**
- [ ] **Step 2: Run `npm pack --dry-run`, registry validation, and an Inspector `tools/list`; expect intended package contents, valid manifest, and exactly four tools.**
- [ ] **Step 3: With existing local credentials, run a bounded, explicit, read-only `pirsch_list_domains` and `pirsch_query_statistics` smoke test; verify structured result and safe domain projection.**
- [ ] **Step 4: Run `git diff --check` and status checks in both repositories; report command evidence, breaking migration, and both commit IDs in the final handoff.**
