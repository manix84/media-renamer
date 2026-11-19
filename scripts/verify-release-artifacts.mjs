import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const platform = process.argv[2];
const architecture = process.argv[3];
const macArchitecture = architecture ? architecture.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '.*';
const required = {
  win: [/win-.*-unsigned-installer\.msi$/i, /win-.*-unsigned-portable\.exe$/i],
  mac: [new RegExp(`mac-${macArchitecture}-unsigned-installer\\.dmg$`, 'i'), new RegExp(`mac-${macArchitecture}-unsigned-portable\\.zip$`, 'i')],
  linux: [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i, /linux-.*-portable\.tar\.gz$/i],
}[platform];
if (!required) throw new Error(`Unknown release platform: ${platform}`);
const names = await fs.promises.readdir(path.resolve('release'));
const missing = required.filter((pattern) => !names.some((name) => pattern.test(name)));
if (missing.length) throw new Error(`Missing ${platform} release artifacts matching: ${missing.join(', ')}. Found: ${names.join(', ')}`);
console.log(`Verified ${platform} release artifacts: ${names.filter((name) => required.some((pattern) => pattern.test(name))).join(', ')}`);
