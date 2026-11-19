import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageJson = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf8'));
const releaseDirectory = path.join(root, 'release');
const releaseEntries = await fs.promises.readdir(releaseDirectory, { withFileTypes: true });
const appParents = releaseEntries.filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'));
let sourceApp;
for (const parent of appParents) {
  const candidate = path.join(releaseDirectory, parent.name, `${packageJson.build.productName}.app`);
  try {
    await fs.promises.access(candidate, fs.constants.R_OK);
    sourceApp = candidate;
    break;
  } catch { /* Try the next Electron Builder output directory. */ }
}
if (!sourceApp) throw new Error('Could not find the packaged macOS application in release/mac*.');

const parentName = path.basename(path.dirname(sourceApp));
const architecture = parentName === 'mac' ? process.arch : parentName.replace(/^mac-/, '');
const bundleName = `${packageJson.build.productName}-${packageJson.version}-mac-${architecture}-unsigned-portable`;
const temporaryDirectory = await fs.promises.mkdtemp(path.join(releaseDirectory, '.portable-mac-'));
const stagedBundle = path.join(temporaryDirectory, bundleName);
const archivePath = path.join(releaseDirectory, `${bundleName}.zip`);

try {
  await fs.promises.mkdir(path.join(stagedBundle, 'data'), { recursive: true });
  await fs.promises.cp(sourceApp, path.join(stagedBundle, path.basename(sourceApp)), {
    recursive: true,
    preserveTimestamps: true,
    verbatimSymlinks: true,
  });
  await fs.promises.writeFile(path.join(stagedBundle, 'data', '.keep'), 'Media Renamer stores portable application data in this folder.\n');
  const launcher = `#!/bin/sh
set -eu

portable_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data="$portable_root/data"
app="$portable_root/Media Renamer.app/Contents/MacOS/Media Renamer"

mkdir -p "$data"
MEDIA_RENAMER_PORTABLE_DATA="$data" exec "$app" "$@"
`;
  const launcherPath = path.join(stagedBundle, 'Run Media Renamer.command');
  await fs.promises.writeFile(launcherPath, launcher);
  await fs.promises.chmod(launcherPath, 0o755);
  await fs.promises.writeFile(path.join(stagedBundle, 'README.txt'), `Media Renamer portable for macOS

Double-click "Run Media Renamer.command" to start the app. Keep the application,
launcher, and data folder together. Preferences, rename history, caches, and
installed extensions are stored in the adjacent data folder.

This build is ad-hoc signed for application integrity, but it is not signed with
an Apple Developer ID and is not notarised. macOS may require approval in
System Settings > Privacy & Security the first time it is opened.

Extension credentials use macOS Keychain encryption and may need to be entered
again when the portable folder is moved to another Mac.
`);
  await fs.promises.rm(archivePath, { force: true });
  const result = spawnSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', stagedBundle, archivePath], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ditto exited with status ${result.status}`);
  const verificationDirectory = path.join(temporaryDirectory, 'verify');
  await fs.promises.mkdir(verificationDirectory);
  const extractResult = spawnSync('ditto', ['-x', '-k', archivePath, verificationDirectory], { stdio: 'inherit' });
  if (extractResult.error) throw extractResult.error;
  if (extractResult.status !== 0) throw new Error(`ditto extraction exited with status ${extractResult.status}`);
  const extractedApp = path.join(verificationDirectory, bundleName, path.basename(sourceApp));
  const signatureResult = spawnSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', extractedApp], { stdio: 'inherit' });
  if (signatureResult.error) throw signatureResult.error;
  if (signatureResult.status !== 0) throw new Error(`Extracted portable application failed integrity verification with status ${signatureResult.status}`);
  console.log(`Created ${path.relative(root, archivePath)}`);
} finally {
  await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
}
