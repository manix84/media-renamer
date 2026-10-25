import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ExtensionSecretVault, type SecretSealer } from './extensionSecrets';

const directories: string[] = [];

function fakeSealer(available = true): SecretSealer {
  return {
    available: () => available,
    seal: (value) => Buffer.from(`sealed:${value}`),
    unseal: (value) => {
      const decoded = value.toString();
      if (!decoded.startsWith('sealed:')) throw new Error('bad ciphertext');
      return decoded.slice(7);
    },
  };
}

async function vault(sealer = fakeSealer()): Promise<{ store: ExtensionSecretVault; filePath: string }> {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'media-renamer-extension-secrets-'));
  directories.push(directory);
  const filePath = path.join(directory, 'extension-secrets.json');
  return { store: new ExtensionSecretVault(filePath, sealer), filePath };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.promises.rm(directory, { recursive: true, force: true })));
});

describe('extension credential vault', () => {
  it('stores only encrypted values and returns keys without revealing secrets', async () => {
    const { store, filePath } = await vault();
    await store.set('example.metadata', 'api-token', 'very-secret');
    expect(await store.get('example.metadata', 'api-token')).toBe('very-secret');
    expect(await store.keys('example.metadata')).toEqual(['api-token']);
    const contents = await fs.promises.readFile(filePath, 'utf8');
    expect(contents).not.toContain('very-secret');
    expect((await fs.promises.stat(filePath)).mode & 0o777).toBe(0o600);
  });

  it('keeps extension credentials isolated and supports scoped deletion', async () => {
    const { store } = await vault();
    await store.set('first.provider', 'token', 'first');
    await store.set('second.provider', 'token', 'second');
    expect(await store.delete('first.provider', 'token')).toBe(true);
    expect(await store.get('first.provider', 'token')).toBeUndefined();
    expect(await store.get('second.provider', 'token')).toBe('second');
    expect(await store.delete('second.provider')).toBe(true);
    expect(await store.keys('second.provider')).toEqual([]);
  });

  it('refuses to store or read secrets when OS encryption is unavailable', async () => {
    const { store } = await vault(fakeSealer(false));
    expect(store.available()).toBe(false);
    await expect(store.set('example.metadata', 'token', 'secret')).rejects.toThrow('unavailable');
    await expect(store.get('example.metadata', 'token')).rejects.toThrow('unavailable');
  });

  it('rejects invalid identities, oversized secrets, malformed vaults, and corrupt ciphertext', async () => {
    const { store, filePath } = await vault();
    await expect(store.set('../escape', 'token', 'secret')).rejects.toThrow('owner is invalid');
    await expect(store.set('example.metadata', 'bad key', 'secret')).rejects.toThrow('key is invalid');
    await expect(store.set('example.metadata', 'token', 'x'.repeat(17 * 1024))).rejects.toThrow('too large');
    await fs.promises.writeFile(filePath, '{broken');
    await expect(store.keys('example.metadata')).rejects.toThrow();
    await fs.promises.writeFile(filePath, JSON.stringify({ version: 1, extensions: { 'example.metadata': { token: Buffer.from('wrong').toString('base64') } } }));
    await expect(store.get('example.metadata', 'token')).rejects.toThrow('could not be decrypted');
  });
});
