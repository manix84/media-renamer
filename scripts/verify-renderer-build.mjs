import fs from 'node:fs';
import path from 'node:path';

const indexPath = path.resolve('dist/index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
  .map((match) => match[1])
  .filter((url) => !/^(?:[a-z]+:|#)/i.test(url));

const rootRelativeAsset = assetUrls.find((url) => url.startsWith('/'));
if (rootRelativeAsset) {
  throw new Error(`Renderer asset must be relative for file:// packaging: ${rootRelativeAsset}`);
}

for (const url of assetUrls) {
  const assetPath = path.resolve('dist', url);
  if (!fs.existsSync(assetPath)) throw new Error(`Renderer asset is missing: ${url}`);
}

console.log(`Verified ${assetUrls.length} relative renderer assets.`);
