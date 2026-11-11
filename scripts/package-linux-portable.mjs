import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageJson = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf8'));
const releaseDirectory = path.join(root, 'release');
const sourceName = `${packageJson.build.productName}-${packageJson.version}-linux-x86_64.AppImage`;
const sourcePath = path.join(releaseDirectory, sourceName);
const bundleName = `${packageJson.build.productName}-${packageJson.version}-linux-x86_64-portable`;
const bundleDirectory = path.join(releaseDirectory, bundleName);
const archivePath = `${bundleDirectory}.tar.gz`;

await fs.promises.access(sourcePath, fs.constants.R_OK);
const temporaryDirectory = await fs.promises.mkdtemp(path.join(releaseDirectory, '.portable-'));

try {
  const stagedBundle = path.join(temporaryDirectory, bundleName);
  const dataDirectory = path.join(stagedBundle, 'data');
  const portableAppName = 'Media Renamer.AppImage';
  await fs.promises.mkdir(dataDirectory, { recursive: true });
  await fs.promises.copyFile(sourcePath, path.join(stagedBundle, portableAppName));
  await fs.promises.chmod(path.join(stagedBundle, portableAppName), 0o755);
  await fs.promises.writeFile(path.join(dataDirectory, '.keep'), 'Media Renamer stores portable application data in this folder.\n');

  const launcher = `#!/bin/sh
set -eu

portable_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
app="$portable_root/${portableAppName}"
data="$portable_root/data"

mkdir -p "$data/home" "$data/config" "$data/cache"
chmod +x "$app" 2>/dev/null || true

HOME="$data/home" \\
XDG_CONFIG_HOME="$data/config" \\
XDG_CACHE_HOME="$data/cache" \\
APPIMAGE_EXTRACT_AND_RUN=1 \\
"$app" "$@"
`;
  const launcherPath = path.join(stagedBundle, 'Run Media Renamer.sh');
  await fs.promises.writeFile(launcherPath, launcher);
  await fs.promises.chmod(launcherPath, 0o755);

  await fs.promises.writeFile(path.join(stagedBundle, 'README.txt'), `Media Renamer portable for Linux (x86-64)

Run "Run Media Renamer.sh" to start the app. The launcher keeps preferences,
rename history, caches, and installed extensions inside the adjacent data folder.
Keep the entire folder together when moving it between machines. This is the
important difference from the standard AppImage, which stores its application
data in the current computer's user profile instead.

If your desktop will not launch the script, open a terminal in this folder and run:
  chmod +x "Run Media Renamer.sh" "Media Renamer.AppImage"
  ./"Run Media Renamer.sh"

The launcher uses AppImage extract-and-run mode, so FUSE and package installation
are not required. Some USB drives are mounted with execution disabled. If that
happens, copy the portable folder to a Linux filesystem or remount the drive with
execution allowed.

Extension credentials use Electron's operating-system encryption. They may need
to be entered again on a different computer even though other extension settings
travel in the data folder.
`);

  await fs.promises.rm(bundleDirectory, { recursive: true, force: true });
  await fs.promises.rm(archivePath, { force: true });
  await fs.promises.rename(stagedBundle, bundleDirectory);
  const result = spawnSync('tar', ['-czf', archivePath, '-C', releaseDirectory, bundleName], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`tar exited with status ${result.status}`);
  console.log(`Created ${path.relative(root, archivePath)}`);
} finally {
  await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
}
