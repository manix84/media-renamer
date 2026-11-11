import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { releaseCommitVersion } from './release-automation.mjs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
if (packageLock.version !== packageJson.version || packageLock.packages[''].version !== packageJson.version) throw new Error('package.json and package-lock.json versions do not match.');
const subject = spawnSync('git', ['show', '-s', '--format=%s', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
if (releaseCommitVersion(subject) !== packageJson.version) throw new Error(`HEAD must be chore(release): v${packageJson.version}.`);
const notes = spawnSync(process.execPath, ['scripts/release-notes.mjs', packageJson.version], { encoding: 'utf8' });
if (notes.status !== 0 || !notes.stdout.trim()) throw new Error(notes.stderr.trim() || 'Release notes are missing.');
console.log(`Release v${packageJson.version} is ready.`);
