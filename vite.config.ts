import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

const packageVersion = (JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(packageVersion) },
  server: { port: 5173, strictPort: true },
  test: { environment: 'node', exclude: ['node_modules/**', 'dist/**', 'dist-electron/**'] },
});
