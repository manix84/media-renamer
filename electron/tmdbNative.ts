import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);

export function tmdbHelperPath(resourcesPath: string, platform = process.platform): string {
  return path.join(resourcesPath, 'bin', platform === 'win32' ? 'tmdb-helper.exe' : 'tmdb-helper');
}

export function hasTmdbHelper(resourcesPath: string, platform = process.platform): boolean {
  return fs.existsSync(tmdbHelperPath(resourcesPath, platform));
}

export function nativeTmdbFetch(resourcesPath: string, platform = process.platform): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.protocol !== 'https:' || url.hostname !== 'api.themoviedb.org' || !url.pathname.startsWith('/3/')) throw new Error('Native TMDB helper rejected an unexpected destination.');
    const { stdout } = await executeFile(tmdbHelperPath(resourcesPath, platform), [`${url.pathname}${url.search}`], { encoding: 'utf8', maxBuffer: 21 * 1024 * 1024, timeout: 25_000, windowsHide: true });
    const envelope = JSON.parse(stdout) as { status?: unknown; body?: unknown };
    if (!Number.isInteger(envelope.status) || Number(envelope.status) < 100 || Number(envelope.status) > 599 || envelope.body === undefined) throw new Error('Native TMDB helper returned an invalid response.');
    return new Response(JSON.stringify(envelope.body), { status: Number(envelope.status), headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}
