import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const root = process.cwd();
const target = process.argv[2]?.replace(/^--/, '') ?? ({ darwin: 'mac', win32: 'win', linux: 'linux' }[process.platform]);
if (!['linux', 'mac', 'win'].includes(target)) throw new Error('Usage: node scripts/build-tmdb-helper.mjs [linux|mac|win]');

function localToken() {
  if (process.env.TMDB_ACCESS_TOKEN) return process.env.TMDB_ACCESS_TOKEN.trim();
  try {
    const line = fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).find((entry) => entry.trimStart().startsWith('TMDB_ACCESS_TOKEN='));
    return line?.split('=').slice(1).join('=').trim().replace(/^(['"])(.*)\1$/, '$2');
  } catch { return undefined; }
}

const token = localToken();
if (!token) throw new Error('TMDB_ACCESS_TOKEN is required to build the release helper.');
const bytes = Buffer.from(token);
const mask = crypto.randomBytes(bytes.length);
const encoded = Buffer.from(bytes.map((value, index) => value ^ mask[index]));
const outputDirectory = path.join(root, 'native-helper-dist');
fs.mkdirSync(outputDirectory, { recursive: true });
for (const entry of fs.readdirSync(outputDirectory)) if (entry !== '.gitkeep') fs.rmSync(path.join(outputDirectory, entry), { recursive: true, force: true });

const platform = { linux: 'linux', mac: 'darwin', win: 'windows' }[target];
const architecture = target === 'mac' ? 'arm64' : 'amd64';
const filename = target === 'win' ? 'tmdb-helper.exe' : 'tmdb-helper';
const output = path.join(outputDirectory, filename);
const ldflags = `-s -w -X main.encodedToken=${encoded.toString('base64')} -X main.tokenMask=${mask.toString('base64')}`;
const test = spawnSync('go', ['test', './...'], {
  cwd: path.join(root, 'native/tmdb-helper'), env: { ...process.env, CGO_ENABLED: '0' }, stdio: 'inherit',
});
if (test.status !== 0) process.exit(test.status ?? 1);
const result = spawnSync('go', ['build', '-trimpath', '-ldflags', ldflags, '-o', output, '.'], {
  cwd: path.join(root, 'native/tmdb-helper'), env: { ...process.env, CGO_ENABLED: '0', GOOS: platform, GOARCH: architecture }, stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);
const binary = fs.readFileSync(output);
if (binary.includes(bytes)) { fs.rmSync(output, { force: true }); throw new Error('The compiled helper contains the plaintext TMDB token.'); }
if (target !== 'win') fs.chmodSync(output, 0o755);
console.log(`Built stripped TMDB helper for ${platform}/${architecture}; plaintext credential scan passed.`);
