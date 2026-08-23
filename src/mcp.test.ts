import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPirschServer, type PirschReader } from './server.js';
import { comparisonInputSchema, filterOptionsInputSchema, statisticsQuerySchema } from './schemas.js';

const servers: Array<ReturnType<typeof createPirschServer>> = [];
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function connect(clientFactory: () => PirschReader) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createPirschServer({ clientFactory, defaultDomainId: 'default-domain' });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  servers.push(server);
  clients.push(client);
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe('Pirsch MCP tool contracts', () => {
  it('returns only safe domains as structured content with a JSON text fallback', async () => {
    const listDomains = vi.fn().mockResolvedValue([{ id: 'domain-1', hostname: 'example.com', timezone: 'UTC' }]);
    const client = await connect(() => ({ listDomains, get: vi.fn() }));

    const result = await client.callTool({ name: 'pirsch_list_domains', arguments: {} });
    const output = { domains: [{ id: 'domain-1', hostname: 'example.com', timezone: 'UTC' }] };

    expect(result.structuredContent).toEqual(output);
    expect(JSON.parse((result.content as Array<{ text: string }>)[0].text)).toEqual(output);
  });

  it('requires a date range for time-series statistics and marks the result as an MCP error', async () => {
    const get = vi.fn();
    const client = await connect(() => ({ listDomains: vi.fn(), get }));

    const result = await client.callTool({ name: 'pirsch_query_statistics', arguments: { metric: 'pages' } });

    expect(result.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  it('rejects invalid clock values and filters for the unfilterable overview metric', async () => {
    expect(statisticsQuerySchema.safeParse({ metric: 'pages', fromTime: '99:99' }).success).toBe(false);
    expect(statisticsQuerySchema.safeParse({ metric: 'pages', from: '2026-08-31', to: '2026-08-01' }).success).toBe(false);
    expect(statisticsQuerySchema.safeParse({ metric: 'pages', from: '2026-08-01', to: '2026-08-01', fromTime: '18:00', toTime: '09:00' }).success).toBe(false);
    expect(comparisonInputSchema.safeParse({ period: 'week', from: '2026-08-01', to: '2026-08-02' }).success).toBe(false);
    expect(filterOptionsInputSchema.safeParse({ option: 'tagValue' }).success).toBe(false);
    expect(filterOptionsInputSchema.safeParse({ option: 'metadata' }).success).toBe(false);
    const get = vi.fn();
    const client = await connect(() => ({ listDomains: vi.fn(), get }));

    const result = await client.callTool({ name: 'pirsch_query_statistics', arguments: { metric: 'overview', country: 'US' } });

    expect(result.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  it('uses the selected default domain and documented option endpoint', async () => {
    const get = vi.fn().mockResolvedValue(['signup']);
    const client = await connect(() => ({ listDomains: vi.fn(), get }));

    const result = await client.callTool({ name: 'pirsch_list_filter_options', arguments: { option: 'event' } });

    expect(result.isError).toBeUndefined();
    expect(get).toHaveBeenCalledWith('/options/event', 'default-domain', {});
  });
});
