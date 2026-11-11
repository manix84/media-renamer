import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';
import { classifyRelease, nextVersion, releaseCommitVersion, updateWhatsNew } from './release-automation.mjs';

function git(args, options = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `git ${args.join(' ')} failed.`);
  return result.stdout?.trim() ?? '';
}

function mainPushFromInput(input) {
  for (const line of input.trim().split(/\r?\n/).filter(Boolean)) {
    const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
    if (remoteRef === 'refs/heads/main' && !/^0+$/.test(localSha)) return { localRef, localSha, remoteSha };
  }
  return undefined;
}

const prePush = process.argv.includes('--pre-push');
const push = prePush ? mainPushFromInput(fs.readFileSync(0, 'utf8')) : undefined;
if (prePush && !push) process.exit(0);

const localSha = push?.localSha ?? git(['rev-parse', 'HEAD']);
const remoteSha = push?.remoteSha && !/^0+$/.test(push.remoteSha) ? push.remoteSha : git(['rev-parse', 'origin/main']);
const headSubject = git(['show', '-s', '--format=%s', localSha]);
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (git(['status', '--porcelain'])) throw new Error('Commit or stash all changes before preparing a release.');
const preparedVersion = releaseCommitVersion(headSubject);
if (preparedVersion) {
  if (preparedVersion !== packageJson.version) throw new Error(`Release commit ${preparedVersion} does not match package version ${packageJson.version}.`);
  process.exit(0);
}

const latestReleaseCommit = git(['log', `${remoteSha}..${localSha}`, '--format=%H%x09%s'])
  .split('\n').filter(Boolean).find((line) => releaseCommitVersion(line.split('\t').slice(1).join('\t')))?.split('\t')[0];
const range = `${latestReleaseCommit ?? remoteSha}..${localSha}`;
const rawCommits = git(['log', range, '--format=%H%x1f%s%x1f%b%x1e']);
const commits = rawCommits.split('\x1e').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
  const [hash, subject, body] = entry.split('\x1f');
  return { hash, subject, body };
});
if (!commits.length) process.exit(0);

const releaseType = classifyRelease(commits);
const version = nextVersion(packageJson.version, releaseType);
const date = new Date().toISOString().slice(0, 10);
packageJson.version = version;
fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
packageLock.version = version;
packageLock.packages[''].version = version;
fs.writeFileSync('package-lock.json', `${JSON.stringify(packageLock, null, 2)}\n`);
fs.writeFileSync('WHATSNEW.md', updateWhatsNew(fs.readFileSync('WHATSNEW.md', 'utf8'), version, date));

git(['add', 'package.json', 'package-lock.json', 'WHATSNEW.md']);
git(['commit', '-m', `chore(release): v${version}`], { stdio: 'inherit' });
console.error(`Prepared ${releaseType} release v${version} from ${commits.length} commit${commits.length === 1 ? '' : 's'}.`);
if (prePush) {
  console.error('The push was stopped so the generated release commit can be reviewed. Push again to publish it.');
  process.exit(1);
}
