import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const REQUESTS_PER_MINUTE = 30;

export interface ExtensionNetworkPolicy {
  extensionId: string;
  enabled: boolean;
  grantedCapabilities: string[];
  allowedOrigins: string[];
}

export interface ExtensionJsonRequest {
  url: string;
  method?: 'GET' | 'POST';
  body?: unknown;
}

type AddressResolver = (hostname: string) => Promise<string[]>;

function privateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168);
  }
  if (net.isIPv6(address)) return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb');
  return true;
}

async function systemResolver(hostname: string): Promise<string[]> {
  return (await dns.lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

async function responseBytes(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw new Error('Extension metadata response is too large.');
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Extension metadata response is too large.');
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export class ExtensionNetworkBroker {
  private readonly requests = new Map<string, number[]>();

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly resolver: AddressResolver = systemResolver,
    private readonly now: () => number = Date.now,
  ) {}

  private async validatedUrl(value: string, allowedOrigins: Set<string>): Promise<URL> {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Extension metadata URL is invalid.'); }
    if (url.protocol !== 'https:' || url.username || url.password || !allowedOrigins.has(url.origin)) throw new Error('Extension metadata origin is not allowed.');
    if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) throw new Error('Extension metadata cannot access local addresses.');
    const addresses = await this.resolver(url.hostname);
    if (!addresses.length || addresses.some(privateAddress)) throw new Error('Extension metadata cannot access private or unresolved addresses.');
    return url;
  }

  private consumeRate(extensionId: string): void {
    const cutoff = this.now() - 60_000;
    const recent = (this.requests.get(extensionId) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= REQUESTS_PER_MINUTE) throw new Error('Extension metadata request limit exceeded.');
    recent.push(this.now());
    this.requests.set(extensionId, recent);
  }

  async requestJson(policy: ExtensionNetworkPolicy, request: ExtensionJsonRequest): Promise<unknown> {
    if (!policy.enabled || !policy.grantedCapabilities.includes('network.metadata')) throw new Error('Extension metadata network access has not been granted.');
    const allowedOrigins = new Set(policy.allowedOrigins.map((origin) => new URL(origin).origin));
    this.consumeRate(policy.extensionId);
    const method = request.method ?? 'GET';
    if (method === 'GET' && request.body !== undefined) throw new Error('Extension metadata GET requests cannot include a body.');
    const encodedBody = request.body === undefined ? undefined : JSON.stringify(request.body);
    if (encodedBody && Buffer.byteLength(encodedBody) > MAX_REQUEST_BODY_BYTES) throw new Error('Extension metadata request is too large.');
    let url = await this.validatedUrl(request.url, allowedOrigins);
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await this.fetcher(url, {
          method,
          redirect: 'manual',
          headers: { accept: 'application/json', ...(encodedBody ? { 'content-type': 'application/json' } : {}) },
          body: encodedBody,
          signal: controller.signal,
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirect === MAX_REDIRECTS) throw new Error('Extension metadata redirected too many times.');
          const location = response.headers.get('location');
          if (!location) throw new Error('Extension metadata redirect is invalid.');
          url = await this.validatedUrl(new URL(location, url).toString(), allowedOrigins);
          continue;
        }
        if (!response.ok) throw new Error(`Extension metadata provider returned HTTP ${response.status}.`);
        const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
        if (contentType !== 'application/json' && contentType !== 'application/graphql-response+json') throw new Error('Extension metadata provider did not return JSON.');
        const bytes = await responseBytes(response);
        try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('Extension metadata provider returned invalid JSON.'); }
      } catch (error) {
        if (controller.signal.aborted) throw new Error('Extension metadata request timed out.');
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error('Extension metadata request failed.');
  }
}
