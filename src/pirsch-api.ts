import fetch from 'node-fetch';
import type { PirschTokenResponse, Domain, FilterInput } from './types.js';
import { buildFilterParams } from './filters.js';

const BASE_URL = 'https://api.pirsch.io/api/v1';

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface TokenCache {
  token: string | null;
  expiresAt: number; // epoch ms
}

export class PirschAPI {
  private clientId: string;
  private clientSecret: string;
  private token: TokenCache = { token: null, expiresAt: 0 };
  private tokenSkewMs: number;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokenSkewMs = parseInt(process.env.PIRSCH_TOKEN_SKEW_MS || '60000', 10);
  }

  private isTokenValid(): boolean {
    if (!this.token.token) return false;
    const now = Date.now();
    return now + this.tokenSkewMs < this.token.expiresAt;
  }

  private async refreshToken(): Promise<void> {
    if (!this.clientId || !this.clientSecret) {
      throw new AuthError(
        'Pirsch credentials missing. PIRSCH_CLIENT_ID and PIRSCH_CLIENT_SECRET must be set.'
      );
    }
    const url = `${BASE_URL}/token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      const masked = this.clientId.slice(0, 6) + '***';
      throw new AuthError(
        `Pirsch auth failed (${res.status}) for client_id=${masked}. ` +
        `Verify PIRSCH_CLIENT_ID and PIRSCH_CLIENT_SECRET are valid in the Pirsch dashboard. ` +
        `Response: ${body}`
      );
    }
    const data = (await res.json()) as PirschTokenResponse;
    this.token.token = data.access_token;
    this.token.expiresAt = Date.parse(data.expires_at);
  }

  private async ensureToken(): Promise<void> {
    if (!this.isTokenValid()) {
      await this.refreshToken();
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options?: { params?: URLSearchParams; body?: unknown },
    retries = 2
  ): Promise<T> {
    await this.ensureToken();

    const url = `${BASE_URL}${endpoint}${options?.params ? `?${options.params.toString()}` : ''}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token.token}`,
      'Content-Type': 'application/json'
    };

    for (let i = 0; i <= retries; i++) {
      const res = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (res.status === 401 && i < retries) {
        // Refresh token and retry
        await this.refreshToken();
        headers['Authorization'] = `Bearer ${this.token.token}`;
        continue;
      }
      if (res.status === 429 && i < retries) {
        const retryAfter = res.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : (i + 1) * 1500;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Pirsch API error (${res.status}): ${text}`);
      }
      if (res.status === 204) return {} as T;
      return (await res.json()) as T;
    }
    throw new Error('Max retries exceeded');
  }

  // Domains
  async listDomains(query?: { search?: string; id?: string; subdomain?: string; domain?: string; access?: string; }): Promise<Domain[] | Domain> {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.id) params.set('id', query.id);
    if (query?.subdomain) params.set('subdomain', query.subdomain);
    if (query?.domain) params.set('domain', query.domain);
    if (query?.access) params.set('access', query.access);

    const result = await this.request<Domain[] | Domain>('GET', '/domain', { params });
    return result;
  }

  // Overview (cached totals and members)
  async getOverview<T = unknown>(domainId: string): Promise<T> {
    const params = new URLSearchParams({ id: domainId });
    return this.request<T>('GET', '/statistics/overview', { params });
  }

  // Generic statistics endpoint helper using filters
  async getStatistics<T = unknown>(
    endpoint: string,
    domainId: string,
    filter: FilterInput = {}
  ): Promise<T> {
    const params = buildFilterParams(filter, domainId, { tz: process.env.PIRSCH_TIMEZONE });
    return this.request<T>('GET', endpoint, { params });
  }

  // Active visitors
  async getActive<T = unknown>(domainId: string, startSeconds?: number): Promise<T> {
    const params = buildFilterParams({ start: startSeconds }, domainId, { tz: process.env.PIRSCH_TIMEZONE });
    return this.request<T>('GET', '/statistics/active', { params });
  }
}
