import { describe, expect, it, vi } from 'vitest';
import { ExtensionNetworkBroker, type ExtensionNetworkPolicy } from './extensionNetwork';

const policy: ExtensionNetworkPolicy = {
  extensionId: 'example.metadata',
  enabled: true,
  grantedCapabilities: ['network.metadata'],
  allowedOrigins: ['https://metadata.example'],
};
const publicResolver = vi.fn(async () => ['203.0.113.10']);

describe('extension metadata network broker', () => {
  it('allows bounded JSON requests to an explicitly granted origin', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ result: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(new ExtensionNetworkBroker(fetcher, publicResolver).requestJson(policy, { url: 'https://metadata.example/search?q=title' })).resolves.toEqual({ result: 'ok' });
    expect(fetcher).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'manual', method: 'GET' }));
  });

  it('requires enablement and an explicit capability grant', async () => {
    const broker = new ExtensionNetworkBroker(vi.fn(), publicResolver);
    await expect(broker.requestJson({ ...policy, enabled: false }, { url: 'https://metadata.example' })).rejects.toThrow('not been granted');
    await expect(broker.requestJson({ ...policy, grantedCapabilities: [] }, { url: 'https://metadata.example' })).rejects.toThrow('not been granted');
  });

  it('rejects unlisted origins, HTTP, credentials, and local addresses', async () => {
    const broker = new ExtensionNetworkBroker(vi.fn(), publicResolver);
    await expect(broker.requestJson(policy, { url: 'https://other.example' })).rejects.toThrow('origin is not allowed');
    await expect(broker.requestJson(policy, { url: 'http://metadata.example' })).rejects.toThrow('origin is not allowed');
    await expect(broker.requestJson(policy, { url: 'https://user:pass@metadata.example' })).rejects.toThrow('origin is not allowed');
    await expect(new ExtensionNetworkBroker(vi.fn(), async () => ['127.0.0.1']).requestJson(policy, { url: 'https://metadata.example' })).rejects.toThrow('private');
  });

  it('checks redirects against the same origin and address policy', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://other.example/result' } }));
    await expect(new ExtensionNetworkBroker(fetcher, publicResolver).requestJson(policy, { url: 'https://metadata.example' })).rejects.toThrow('origin is not allowed');
  });

  it('rejects non-JSON and oversized responses', async () => {
    const textBroker = new ExtensionNetworkBroker(vi.fn(async () => new Response('hello', { headers: { 'content-type': 'text/plain' } })), publicResolver);
    await expect(textBroker.requestJson(policy, { url: 'https://metadata.example' })).rejects.toThrow('did not return JSON');
    const largeBroker = new ExtensionNetworkBroker(vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(3 * 1024 * 1024) } })), publicResolver);
    await expect(largeBroker.requestJson(policy, { url: 'https://metadata.example' })).rejects.toThrow('too large');
  });

  it('rate limits each extension independently', async () => {
    const broker = new ExtensionNetworkBroker(vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })), publicResolver, () => 1000);
    for (let index = 0; index < 30; index += 1) await broker.requestJson(policy, { url: 'https://metadata.example' });
    await expect(broker.requestJson(policy, { url: 'https://metadata.example' })).rejects.toThrow('limit exceeded');
  });
});
