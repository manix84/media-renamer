import fs from 'node:fs';

const version = (process.argv[2] ?? '').replace(/^v/, '');
if (!version) {
  console.error('Usage: npm run release:notes -- <version> [output-file]');
  process.exit(1);
}

const changelog = fs.readFileSync(new URL('../WHATSNEW.md', import.meta.url), 'utf8');
const heading = `## [${version}]`;
const start = changelog.indexOf(heading);
const contentStart = start < 0 ? -1 : changelog.indexOf('\n', start) + 1;
const nextHeading = contentStart > 0 ? changelog.indexOf('\n## [', contentStart) : -1;
const references = contentStart > 0 ? changelog.indexOf('\n[Unreleased]:', contentStart) : -1;
const candidates = [nextHeading, references].filter((position) => position >= 0);
const contentEnd = candidates.length ? Math.min(...candidates) : undefined;
const notes = contentStart > 0
  ? changelog.slice(contentStart, contentEnd).trim()
  : '';

if (!notes) {
  console.error(`WHATSNEW.md has no release notes for ${version}.`);
  process.exit(1);
}

const output = process.argv[3];
if (output) fs.writeFileSync(output, `${notes}\n`);
else process.stdout.write(`${notes}\n`);
