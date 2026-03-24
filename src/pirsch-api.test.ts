import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PirschAPI } from './pirsch-api.js';
import type { Response, Headers } from 'node-fetch';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

import fetch from 'node-fetch';
const mockFetch = vi.mocked(fetch);

// Helper to create mock response objects
const mockResponse = (data: Partial<Response>): Response => data as Response;

describe('PirschAPI', () => {
  const clientId = 'test-client-id';
  const clientSecret = 'test-client-secret';
  let api: PirschAPI;

  const mockTokenResponse = {
    access_token: 'test-token-123',
    expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api = new PirschAPI(clientId, clientSecret);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('authentication', () => {
    it('should fetch a new token when none exists', async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockResponse({
            ok: true,
            json: async () => mockTokenResponse,
          })
        )
        .mockResolvedValueOnce(
          mockResponse({
            ok: true,
            json: async () => [{ id: 'domain-1', hostname: 'example.com' }],
          })
        );

      await api.listDomains();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://api.pirsch.io/api/v1/token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
          }),
        })
      );
    });

    it('should reuse cached token for subsequent requests', async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockResponse({
            ok: true,
            json: async () => mockTokenResponse,
          })
        )
        .mockResolvedValueOnce(
          mockResponse({
            ok: true,
            json: async () => [{ id: 'domain-1' }],
          })
        )
        .mockResolvedValueOnce(
          mockResponse({
            ok: true,
            json: async () => [{ id: 'domain-1' }],
          })
        );

      await api.listDomains();
      await api.listDomains();

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error on auth failure', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 401,
          text: async () => 'Invalid credentials',
        })
      );

      await expect(api.listDomains()).rejects.toThrow('Pirsch auth failed (401)');
    });
  });

  describe('listDomains', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => mockTokenResponse,
        })
      );
    });

    it('should list domains without filters', async () => {
      const domains = [
        { id: 'domain-1', hostname: 'example.com' },
        { id: 'domain-2', hostname: 'test.com' },
      ];

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => domains,
        })
      );

      const result = await api.listDomains();

      expect(result).toEqual(domains);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.pirsch.io/api/v1/domain?',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockTokenResponse.access_token}`,
          }),
        })
      );
    });

    it('should pass search parameter', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => [{ id: 'domain-1' }],
        })
      );

      await api.listDomains({ search: 'example' });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('search=example'),
        expect.anything()
      );
    });
  });

  describe('getOverview', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => mockTokenResponse,
        })
      );
    });

    it('should fetch overview for a domain', async () => {
      const overview = { visitors: 1000, views: 5000 };

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => overview,
        })
      );

      const result = await api.getOverview('domain-1');

      expect(result).toEqual(overview);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.pirsch.io/api/v1/statistics/overview?id=domain-1',
        expect.anything()
      );
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => mockTokenResponse,
        })
      );
    });

    it('should fetch statistics with filters', async () => {
      const stats = { visitors: 500, views: 1500 };

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => stats,
        })
      );

      const result = await api.getStatistics('/statistics/total', 'domain-1', {
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(result).toEqual(stats);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('from=2024-01-01'),
        expect.anything()
      );
    });
  });

  describe('getActive', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => mockTokenResponse,
        })
      );
    });

    it('should fetch active visitors with default time window', async () => {
      const active = { visitors: 10, pages: [] };

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => active,
        })
      );

      const result = await api.getActive('domain-1');

      expect(result).toEqual(active);
    });

    it('should fetch active visitors with custom time window', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => ({ visitors: 5 }),
        })
      );

      await api.getActive('domain-1', 300);

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('start=300'),
        expect.anything()
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on 401 and refresh token', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => mockTokenResponse,
        })
      );

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 401,
          text: async () => 'Token expired',
        })
      );

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => ({
            ...mockTokenResponse,
            access_token: 'new-token-456',
          }),
        })
      );

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => [{ id: 'domain-1' }],
        })
      );

      const result = await api.listDomains();

      expect(result).toEqual([{ id: 'domain-1' }]);
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should retry on 429 with backoff', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => mockTokenResponse,
        })
      );

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 429,
          headers: { get: () => '2', raw: () => ({}) } as unknown as Headers,
          text: async () => 'Rate limited',
        })
      );

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => [{ id: 'domain-1' }],
        })
      );

      const resultPromise = api.listDomains();

      await vi.advanceTimersByTimeAsync(2500);

      const result = await resultPromise;

      expect(result).toEqual([{ id: 'domain-1' }]);
    });

    it('should handle 204 No Content response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => mockTokenResponse,
        })
      );

      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 204,
        })
      );

      const result = await api.getStatistics('/statistics/total', 'domain-1', {});

      expect(result).toEqual({});
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          json: async () => mockTokenResponse,
        })
      );
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 400,
          text: async () => 'Bad request',
        })
      );

      await expect(api.listDomains()).rejects.toThrow('Pirsch API error (400)');
    });
  });
});
