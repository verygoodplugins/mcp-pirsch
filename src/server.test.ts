import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { describe, expect, it } from 'vitest';
import { createPirschServer } from './server.js';

describe('createPirschServer', () => {
  it('registers the four public tools', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createPirschServer();
    await server.connect(serverTransport);

    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await client.connect(clientTransport);

    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual([
      'pirsch_list_domains',
      'pirsch_query_statistics',
      'pirsch_list_filter_options',
      'pirsch_compare_periods',
    ]);
  });
});
