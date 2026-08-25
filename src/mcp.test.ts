import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPirschServer, type PirschReader } from './server.js';
import { comparisonInputSchema, filterOptionsInputSchema, statisticsQuerySchema } from './schemas.js';

const servers: Array<ReturnType<typeof createPirschServer>> = [];
const clients: Client[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function connectOptions(options: Parameters<typeof createPirschServer>[0]) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createPirschServer(options);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  servers.push(server);
  clients.push(client);
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

async function connect(clientFactory: () => PirschReader) {
  return connectOptions({ clientFactory, defaultDomainId: 'default-domain' });
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
    expect(comparisonInputSchema.safeParse({
      from: '2026-08-01',
      to: '2026-08-02',
      compareFrom: '2026-07-31',
      compareTo: '2026-07-31',
      fromTime: '18:00',
      toTime: '09:00',
    }).success).toBe(false);
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

  it('resolves named comparison periods in the requested timezone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:30:00.000Z'));
    const get = vi.fn().mockResolvedValue({ visitors: 1 });
    const client = await connect(() => ({ listDomains: vi.fn(), get }));

    const result = await client.callTool({
      name: 'pirsch_compare_periods',
      arguments: { period: 'today', timezone: 'America/Los_Angeles' },
    });

    expect(result.isError).toBeUndefined();
    expect(get.mock.calls[0]).toEqual(['/statistics/total', 'default-domain', expect.objectContaining({
      from: '2026-07-31',
      to: '2026-07-31',
      timezone: 'America/Los_Angeles',
    })]);
  });

  it('uses the timezone-local weekday for named weekly periods', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T00:30:00.000Z'));
    const get = vi.fn().mockResolvedValue({ visitors: 1 });
    const client = await connect(() => ({ listDomains: vi.fn(), get }));

    const result = await client.callTool({
      name: 'pirsch_compare_periods',
      arguments: { period: 'week', timezone: 'America/Los_Angeles' },
    });

    expect(result.isError).toBeUndefined();
    expect(get.mock.calls[0]).toEqual(['/statistics/total', 'default-domain', expect.objectContaining({
      from: '2026-07-27',
      to: '2026-08-02',
    })]);
  });

  it('resolves named comparison periods in the configured timezone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T00:30:00.000Z'));
    const get = vi.fn().mockResolvedValue({ visitors: 1 });
    const client = await connectOptions({
      clientFactory: () => ({ listDomains: vi.fn(), get }),
      clientOptions: { timezone: 'America/Los_Angeles' },
      defaultDomainId: 'default-domain',
    });

    const result = await client.callTool({ name: 'pirsch_compare_periods', arguments: { period: 'today' } });

    expect(result.isError).toBeUndefined();
    expect(get.mock.calls[0]).toEqual(['/statistics/total', 'default-domain', expect.objectContaining({
      from: '2026-07-31',
      to: '2026-07-31',
    })]);
  });

  it('rejects reverse clocks after a named same-day period is resolved', async () => {
    const get = vi.fn();
    const client = await connect(() => ({ listDomains: vi.fn(), get }));

    const result = await client.callTool({
      name: 'pirsch_compare_periods',
      arguments: { period: 'today', fromTime: '18:00', toTime: '09:00' },
    });

    expect(result.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps the environment timezone when custom client options are supplied', async () => {
    const originalTimezone = process.env.PIRSCH_TIMEZONE;
    process.env.PIRSCH_TIMEZONE = 'Europe/Berlin';
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token', expires_at: '2099-01-01T00:00:00.000Z' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ visitors: 1 })));

    try {
      const client = await connectOptions({
        credentials: { clientId: 'client-id', clientSecret: 'client-secret' },
        clientOptions: { fetch, timeoutMs: 1_000 },
        defaultDomainId: 'default-domain',
      });

      const result = await client.callTool({
        name: 'pirsch_query_statistics',
        arguments: { metric: 'total', from: '2026-08-01', to: '2026-08-02' },
      });

      expect(result.isError).toBeUndefined();
      expect(new URL(fetch.mock.calls[1][0] as URL).searchParams.get('tz')).toBe('Europe/Berlin');
    } finally {
      if (originalTimezone === undefined) delete process.env.PIRSCH_TIMEZONE;
      else process.env.PIRSCH_TIMEZONE = originalTimezone;
    }
  });
});
