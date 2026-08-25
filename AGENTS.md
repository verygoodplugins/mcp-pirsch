# MCP Pirsch contributor guide

## Commands

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before handing off changes. Use `npx -y @modelcontextprotocol/inspector@latest --cli node dist/index.js --method tools/list --format json` for an MCP surface check.

## Design constraints

- Keep the server stdio-only and read-only.
- Keep exactly four public tools unless the maintainers approve an API expansion.
- Tool handlers must declare Zod input/output schemas, read-only annotations, structured content, matching JSON text, and `isError: true` for expected failures.
- Do not validate credentials at process start, select a domain automatically, return raw domain/account metadata, log secrets, or include raw upstream error bodies.
- Use `PIRSCH_DEFAULT_DOMAIN_ID` only as an explicit configured default; otherwise require `domainId`.

## Delivery

Do not publish packages or registry entries from local work. The release workflow publishes a release tag to npm first, then the MCP Registry through GitHub OIDC.
