import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX_SECRET_BYTES = 16 * 1024;
const ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,199}$/i;
const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

export interface SecretSealer {
  available(): boolean;
  seal(value: string): Buffer;
  unseal(value: Buffer): string;
}

interface StoredSecretVault {
  version: 1;
  extensions: Record<string, Record<string, string>>;
}

function emptyVault(): StoredSecretVault {
  return { version: 1, extensions: {} };
}

function validateIdentity(extensionId: string, key?: string): void {
  if (!ID_PATTERN.test(extensionId)) throw new Error('Extension secret owner is invalid.');
  if (key !== undefined && !KEY_PATTERN.test(key)) throw new Error('Extension secret key is invalid.');
}

function normalizeVault(value: unknown): StoredSecretVault {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Extension credential vault is invalid.');
  const source = value as Record<string, unknown>;
  if (source.version !== 1 || !source.extensions || typeof source.extensions !== 'object' || Array.isArray(source.extensions)) throw new Error('Extension credential vault is invalid.');
  const extensions: StoredSecretVault['extensions'] = {};
  for (const [extensionId, rawSecrets] of Object.entries(source.extensions as Record<string, unknown>)) {
    validateIdentity(extensionId);
    if (!rawSecrets || typeof rawSecrets !== 'object' || Array.isArray(rawSecrets)) throw new Error('Extension credential vault is invalid.');
    extensions[extensionId] = {};
    for (const [key, ciphertext] of Object.entries(rawSecrets as Record<string, unknown>)) {
      validateIdentity(extensionId, key);
      if (typeof ciphertext !== 'string' || !ciphertext || ciphertext.length > MAX_SECRET_BYTES * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(ciphertext)) throw new Error('Extension credential vault is invalid.');
      extensions[extensionId][key] = ciphertext;
    }
  }
  return { version: 1, extensions };
}

export class ExtensionSecretVault {
  constructor(private readonly filePath: string, private readonly sealer: SecretSealer) {}

  available(): boolean {
    return this.sealer.available();
  }

  private requireEncryption(): void {
    if (!this.available()) throw new Error('Secure credential storage is unavailable on this system.');
  }

  private async read(): Promise<StoredSecretVault> {
    try {
      return normalizeVault(JSON.parse(await fs.promises.readFile(this.filePath, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyVault();
      throw error;
    }
  }

  private async write(value: StoredSecretVault): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      await fs.promises.rename(temporaryPath, this.filePath);
      await fs.promises.chmod(this.filePath, 0o600);
    } catch (error) {
      await fs.promises.unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async set(extensionId: string, key: string, secret: string): Promise<void> {
    validateIdentity(extensionId, key);
    this.requireEncryption();
    if (!secret || Buffer.byteLength(secret) > MAX_SECRET_BYTES) throw new Error('Extension secret is invalid or too large.');
    const vault = await this.read();
    const encrypted = this.sealer.seal(secret);
    vault.extensions[extensionId] = { ...(vault.extensions[extensionId] ?? {}), [key]: encrypted.toString('base64') };
    await this.write(vault);
  }

  async get(extensionId: string, key: string): Promise<string | undefined> {
    validateIdentity(extensionId, key);
    this.requireEncryption();
    const ciphertext = (await this.read()).extensions[extensionId]?.[key];
    if (!ciphertext) return undefined;
    try {
      return this.sealer.unseal(Buffer.from(ciphertext, 'base64'));
    } catch {
      throw new Error('Extension credential could not be decrypted.');
    }
  }

  async keys(extensionId: string): Promise<string[]> {
    validateIdentity(extensionId);
    return Object.keys((await this.read()).extensions[extensionId] ?? {}).sort();
  }

  async delete(extensionId: string, key?: string): Promise<boolean> {
    validateIdentity(extensionId, key);
    const vault = await this.read();
    if (key === undefined) {
      if (!vault.extensions[extensionId]) return false;
      delete vault.extensions[extensionId];
    } else {
      if (!vault.extensions[extensionId]?.[key]) return false;
      delete vault.extensions[extensionId][key];
      if (!Object.keys(vault.extensions[extensionId]).length) delete vault.extensions[extensionId];
    }
    await this.write(vault);
    return true;
  }
}
