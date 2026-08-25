#!/usr/bin/env node
import { config } from 'dotenv';
import { StdioServerTransport, serveStdio } from '@modelcontextprotocol/server/stdio';
import { installStdioLifecycle } from './lifecycle.js';
import { createPirschServer } from './server.js';

function main(): void {
  const parentPid = process.ppid;
  config({ quiet: true });
  const transport = new StdioServerTransport();
  installStdioLifecycle({ transport, parentPid });
  serveStdio(
    () => createPirschServer({ defaultDomainId: process.env.PIRSCH_DEFAULT_DOMAIN_ID }),
    { transport, onerror: (error) => console.error('Server error:', error) }
  );
  console.error('Pirsch MCP server running on stdio');
}

try {
  main();
} catch (error) {
  console.error('Server error:', error);
  process.exit(1);
}
