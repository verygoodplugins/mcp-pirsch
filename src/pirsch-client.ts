import { buildFilterParams, validateV1Filter } from './filters.js';
import type { PirschCredentials, PirschFilter, SafeDomain } from './types.js';

const API_BASE_URL = 'https://api.pirsch.io/api/v1/';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRY_DELAY_MS = 5_000;

interface TokenResponse {
  access_token?: unknown;
  expires_at?: unknown;
}

interface TokenCache {
  accessToken?: string;
  expiresAt: number;
}

export interface PirschClientOptions {
  fetch?: typeof globalThis.fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  timezone?: string;
}

export class PirschError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PirschError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function projectDomain(value: unknown): SafeDomain | undefined {
  const domain = asRecord(value);
  if (!domain || typeof domain.id !== 'string' || typeof domain.hostname !== 'string') return undefined;

  return {
    id: domain.id,
    hostname: domain.hostname,
    ...(typeof domain.display_name === 'string' ? { displayName: domain.display_name } : {}),
    ...(typeof domain.timezone === 'string' ? { timezone: domain.timezone } : {}),
  };
}

function retryDelay(response: Response): number {
  const retryAfter = response.headers.get('retry-after');
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1_000), MAX_RETRY_DELAY_MS);
  }
  return 1_000;
}

export class PirschClient {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly timezone?: string;
  private token: TokenCache = { expiresAt: 0 };
  private refreshPromise?: Promise<void>;

  constructor(
    private readonly credentials: PirschCredentials,
    options: PirschClientOptions = {}
  ) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.timezone = options.timezone;
  }

  async listDomains(): Promise<SafeDomain[]> {
    const result = await this.request<unknown>('/domain');
    const values = Array.isArray(result) ? result : [result];
    const domains: SafeDomain[] = [];
    for (const value of values) {
      const domain = projectDomain(value);
      if (!domain) {
        throw new PirschError('Pirsch domain response was invalid.');
      }
      domains.push(domain);
    }
    return domains;
  }

  async get<T = unknown>(endpoint: string, domainId: string, filter: PirschFilter = {}): Promise<T> {
    validateV1Filter(filter);
    return this.request<T>(endpoint, buildFilterParams(filter, domainId, this.timezone));
  }

  private hasUsableToken(): boolean {
    return Boolean(this.token.accessToken) && Date.now() + 60_000 < this.token.expiresAt;
  }

  private async ensureToken(): Promise<string> {
    if (this.hasUsableToken() && this.token.accessToken) return this.token.accessToken;

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshToken().finally(() => {
        this.refreshPromise = undefined;
      });
    }
    await this.refreshPromise;

    if (!this.token.accessToken) {
      throw new PirschError('Pirsch authentication did not return an access token.');
    }
    return this.token.accessToken;
  }

  private async refreshToken(): Promise<void> {
    if (!this.credentials.clientId || !this.credentials.clientSecret) {
      throw new PirschError('Pirsch credentials are not configured. Set PIRSCH_CLIENT_ID and PIRSCH_CLIENT_SECRET.');
    }

    const response = await this.fetchImpl(`${API_BASE_URL}token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: this.credentials.clientId, client_secret: this.credentials.clientSecret }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new PirschError(`Pirsch authentication failed (${response.status}).`);
    }

    let payload: TokenResponse;
    try {
      const parsed = asRecord(await response.json());
      if (!parsed) throw new Error('Invalid token payload');
      payload = parsed as TokenResponse;
    } catch {
      throw new PirschError('Pirsch authentication returned an invalid token response.');
    }
    if (typeof payload.access_token !== 'string') {
      throw new PirschError('Pirsch authentication returned an invalid token response.');
    }
    const parsedExpiry = typeof payload.expires_at === 'string' ? Date.parse(payload.expires_at) : Number.NaN;
    this.token = {
      accessToken: payload.access_token,
      expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 55 * 60_000,
    };
  }

  private async request<T>(endpoint: string, params?: URLSearchParams): Promise<T> {
    const url = new URL(endpoint.replace(/^\//, ''), API_BASE_URL);
    if (params) url.search = params.toString();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const accessToken = await this.ensureToken();
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.status === 401 && attempt === 0) {
        if (this.token.accessToken === accessToken) {
          this.token = { expiresAt: 0 };
        }
        continue;
      }
      if (response.status === 429 && attempt === 0) {
        await this.sleep(retryDelay(response));
        continue;
      }
      if (!response.ok) {
        throw new PirschError(`Pirsch API request failed (${response.status}).`);
      }
      if (response.status === 204) return {} as T;
      try {
        return (await response.json()) as T;
      } catch {
        throw new PirschError('Pirsch API response was not valid JSON.');
      }
    }

    throw new PirschError('Pirsch API request failed after a retry.');
  }
}
