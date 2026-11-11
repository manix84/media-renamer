import { spawnSync } from 'node:child_process';

const result = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8' });
if (result.status === 0) {
  const configured = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
  if (configured.status !== 0) process.exit(configured.status ?? 1);
  console.log('Configured repository Git hooks from .githooks.');
}
