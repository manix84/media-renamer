import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const executable = (name) => path.join(root, 'node_modules', '.bin', `${name}${process.platform === 'win32' ? '.cmd' : ''}`);
let electron;
let compiling = false;
let compileAgain = false;
let restartTimer;
const electronEnvironment = { ...process.env };
delete electronEnvironment.ELECTRON_RUN_AS_NODE;

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

function launchElectron() {
  electron = spawn(executable('electron'), ['.'], { cwd: root, stdio: 'inherit', env: electronEnvironment });
}

async function compileAndRestart() {
  if (compiling) {
    compileAgain = true;
    return;
  }
  compiling = true;
  const code = await run(executable('tsc'), ['-p', 'electron/tsconfig.json']);
  if (code === 0) {
    const previous = electron;
    if (previous && previous.exitCode === null) {
      previous.once('exit', launchElectron);
      previous.kill('SIGTERM');
    } else {
      launchElectron();
    }
  }
  compiling = false;
  if (compileAgain) {
    compileAgain = false;
    void compileAndRestart();
  }
}

const waitCode = await run(executable('wait-on'), ['tcp:5173']);
if (waitCode !== 0) process.exit(waitCode);
launchElectron();

const watcher = watch(path.join(root, 'electron'), { recursive: true }, (_event, filename) => {
  if (!filename || (!filename.endsWith('.ts') && !filename.endsWith('.cts'))) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => void compileAndRestart(), 120);
});

function shutdown() {
  clearTimeout(restartTimer);
  watcher.close();
  electron?.kill('SIGTERM');
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
