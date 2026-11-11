import fs from 'node:fs';
import path from 'node:path';

export default function verifyTmdbHelper(context) {
  const filename = context.electronPlatformName === 'win32' ? 'tmdb-helper.exe' : 'tmdb-helper';
  const helper = path.join(process.cwd(), 'native-helper-dist', filename);
  if (!fs.existsSync(helper)) throw new Error(`Missing ${filename}. Run npm run build:tmdb-helper -- ${context.electronPlatformName === 'win32' ? 'win' : context.electronPlatformName === 'darwin' ? 'mac' : 'linux'} before packaging.`);
}
