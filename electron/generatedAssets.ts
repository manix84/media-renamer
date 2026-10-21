import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type GeneratedAsset = { targetPath: string; content?: string; url?: string };

export function normalizeGeneratedAssets(value: unknown): GeneratedAsset[] {
  if (!Array.isArray(value) || value.length > 5000) throw new Error('Invalid generated sidecars.');
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid generated sidecar.');
    const item = entry as Record<string, unknown>;
    if (typeof item.targetPath !== 'string' || !path.isAbsolute(item.targetPath) || !/\.(?:nfo|jpe?g|png|tbn)$/i.test(item.targetPath)) throw new Error('Invalid generated sidecar destination.');
    const content = typeof item.content === 'string' && item.content.length <= 5_000_000 ? item.content : undefined;
    const url = typeof item.url === 'string' ? item.url : undefined;
    if (Boolean(content) === Boolean(url)) throw new Error('A generated sidecar needs exactly one content source.');
    if (url) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !/(?:^|\.)(?:tmdb\.org|thetvdb\.com)$/.test(parsed.hostname)) throw new Error('Unsupported artwork host.');
    }
    return { targetPath: item.targetPath, ...(content ? { content } : {}), ...(url ? { url } : {}) };
  });
}

export async function stageGeneratedAssets(value: unknown, stagingRoot: string, fetcher: typeof fetch = fetch): Promise<Array<{ sourcePath: string; targetPath: string }>> {
  const assets = normalizeGeneratedAssets(value);
  const directory = path.join(stagingRoot, crypto.randomUUID());
  await fs.promises.mkdir(directory, { recursive: true });
  const staged: Array<{ sourcePath: string; targetPath: string }> = [];
  try {
    for (const [index, asset] of assets.entries()) {
      try {
        await fs.promises.lstat(asset.targetPath);
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const sourcePath = path.join(directory, `${index}${path.extname(asset.targetPath).toLowerCase()}`);
      if (asset.content !== undefined) await fs.promises.writeFile(sourcePath, asset.content, { encoding: 'utf8', flag: 'wx' });
      else {
        const response = await fetcher(asset.url!);
        if (!response.ok) throw new Error(`Artwork download failed (${response.status}).`);
        const declaredLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > 20_000_000) throw new Error('Artwork file is larger than 20 MB.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 20_000_000) throw new Error('Artwork file is larger than 20 MB.');
        await fs.promises.writeFile(sourcePath, bytes, { flag: 'wx' });
      }
      staged.push({ sourcePath, targetPath: asset.targetPath });
    }
    return staged;
  } catch (error) {
    await fs.promises.rm(directory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
