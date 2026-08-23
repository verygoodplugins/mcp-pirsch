#!/usr/bin/env node
import { config } from 'dotenv';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createPirschServer } from './server.js';

config({ quiet: true });
serveStdio(() => createPirschServer({ defaultDomainId: process.env.PIRSCH_DEFAULT_DOMAIN_ID }));
console.error('Pirsch MCP server running on stdio');
