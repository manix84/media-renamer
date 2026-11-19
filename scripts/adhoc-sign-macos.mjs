import { execFileSync } from 'node:child_process';
import path from 'node:path';

export default function adhocSignMacos(context) {
  if (context.electronPlatformName !== 'darwin') return;
  // electron-builder emits afterPack for each temporary single-architecture app
  // before merging a universal build. Signing those inputs changes CodeResources
  // and prevents @electron/universal from combining them. The hook runs again for
  // the completed universal app, which is the one that should be signed.
  if (path.basename(context.appOutDir).endsWith('-temp')) return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const entitlementsPath = path.join(context.packager.projectDir, 'build', 'entitlements.mac.plist');
  const codesign = '/usr/bin/codesign';

  execFileSync(codesign, [
    '--force',
    '--deep',
    '--sign', '-',
    '--options', 'runtime',
    '--entitlements', entitlementsPath,
    appPath,
  ], { stdio: 'inherit' });

  execFileSync(codesign, [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=4',
    appPath,
  ], { stdio: 'inherit' });
}
