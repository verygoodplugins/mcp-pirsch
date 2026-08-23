import { describe, expect, it, vi } from 'vitest';
import { PirschClient, PirschError } from './pirsch-client.js';

const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function futureIso(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

describe('PirschClient', () => {
  it('shares an in-flight token refresh and projects only safe domain fields', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token', expires_at: futureIso() }))
      .mockImplementation(() => Promise.resolve(jsonResponse([{ id: 'domain-1', hostname: 'example.com', display_name: 'Example', timezone: 'UTC', organization: { email: 'private@example.com' } }])));
    const client = new PirschClient(credentials, { fetch });

    await expect(Promise.all([client.listDomains(), client.listDomains()])).resolves.toEqual([
      [{ id: 'domain-1', hostname: 'example.com', displayName: 'Example', timezone: 'UTC' }],
      [{ id: 'domain-1', hostname: 'example.com', displayName: 'Example', timezone: 'UTC' }],
    ]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('encodes public filters using Pirsch API parameter names', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token', expires_at: futureIso() }))
      .mockResolvedValueOnce(jsonResponse([]));
    const client = new PirschClient(credentials, { fetch });

    await client.get('/statistics/event/meta', 'domain-1', { event: 'Signed up', eventMetaKey: 'plan name', tags: 'pro plan' });

    const request = new URL(String(fetch.mock.calls[1]?.[0]));
    expect(Object.fromEntries(request.searchParams)).toMatchObject({ id: 'domain-1', event: 'Signed up', event_meta_key: 'plan name', tag: 'pro plan' });
  });

  it('honors numeric Retry-After values with a bounded retry', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token', expires_at: futureIso() }))
      .mockResolvedValueOnce(jsonResponse({ error: 'too many requests' }, 429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(jsonResponse([]));
    const client = new PirschClient(credentials, { fetch, sleep });

    await client.listDomains();

    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('redacts credentials and response bodies from errors', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse({ error: 'client-secret access-token' }, 401));
    const client = new PirschClient(credentials, { fetch });

    await expect(client.listDomains()).rejects.toBeInstanceOf(PirschError);
    await expect(client.listDomains()).rejects.not.toThrow(/client-secret|access-token/);
  });

  it('does not invalidate a refreshed token when a concurrent stale request returns 401', async () => {
    let tokenRequests = 0;
    let apiRequests = 0;
    let resolveSecondStaleResponse: ((response: Response) => void) | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>((input) => {
      if (String(input).endsWith('/token')) {
        tokenRequests += 1;
        return Promise.resolve(jsonResponse({ access_token: tokenRequests === 1 ? 'expired-token' : 'fresh-token', expires_at: futureIso() }));
      }

      apiRequests += 1;
      if (apiRequests === 1) return Promise.resolve(jsonResponse({}, 401));
      if (apiRequests === 2) return new Promise<Response>((resolve) => { resolveSecondStaleResponse = resolve; });
      return Promise.resolve(jsonResponse([]));
    });
    const client = new PirschClient(credentials, { fetch });

    const first = client.listDomains();
    const second = client.listDomains();
    await first;
    resolveSecondStaleResponse?.(jsonResponse({}, 401));
    await second;

    expect(tokenRequests).toBe(2);
  });

  it('redacts malformed successful response bodies', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token', expires_at: futureIso() }))
      .mockResolvedValueOnce(new Response('client-secret access-token', { status: 200 }));
    const client = new PirschClient(credentials, { fetch });

    await expect(client.listDomains()).rejects.toThrow('Pirsch API response was not valid JSON.');
  });

  it('rejects structurally invalid successful domain responses', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token', expires_at: futureIso() }))
      .mockResolvedValueOnce(jsonResponse([{ id: 'domain-1' }]));
    const client = new PirschClient(credentials, { fetch });

    await expect(client.listDomains()).rejects.toThrow('Pirsch domain response was invalid.');
  });

  it('rejects invalid v1 filters before sending an upstream request', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const client = new PirschClient(credentials, { fetch });

    await expect(client.get('/statistics/total', 'domain-1', { limit: 101 })).rejects.toThrow('limit must be an integer from 1 to 100.');
    await expect(client.get('/statistics/total', 'domain-1', { from: '2026-08-02', to: '2026-08-01' })).rejects.toThrow('from must be on or before to.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('redacts structurally invalid successful token payloads', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(null));
    const client = new PirschClient(credentials, { fetch });

    await expect(client.listDomains()).rejects.toThrow('Pirsch authentication returned an invalid token response.');
  });
});
