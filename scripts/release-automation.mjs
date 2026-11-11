const RELEASE_HEADING = /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/m;

export function classifyRelease(commits) {
  const messages = commits.map((commit) => `${commit.subject}\n${commit.body ?? ''}`);
  if (messages.some((message) => /BREAKING[ -]CHANGE|^[a-z]+(?:\([^)]*\))?!:/im.test(message))) return 'major';
  if (messages.some((message) => /^(?:feat|feature|remove)(?:\([^)]*\))?:|^(?:add|introduce|support|remove)\b/im.test(message))) return 'minor';
  return 'patch';
}

export function nextVersion(version, releaseType) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (![major, minor, patch].every(Number.isInteger)) throw new Error(`Invalid semantic version: ${version}`);
  if (releaseType === 'major') return `${major + 1}.0.0`;
  if (releaseType === 'minor') return `${major}.${minor + 1}.0`;
  if (releaseType === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Invalid release type: ${releaseType}`);
}

export function releaseCommitVersion(subject) {
  return /^chore\(release\): v(\d+\.\d+\.\d+)$/.exec(subject.trim())?.[1];
}

export function updateWhatsNew(changelog, version, date) {
  const unreleasedHeading = '## [Unreleased]';
  const start = changelog.indexOf(unreleasedHeading);
  const firstRelease = start < 0 ? -1 : changelog.indexOf('\n## [', start + unreleasedHeading.length);
  if (start < 0 || firstRelease < 0) throw new Error('WHATSNEW.md must contain Unreleased followed by a versioned release.');
  const unreleased = changelog.slice(start + unreleasedHeading.length, firstRelease).trim();
  if (!unreleased) throw new Error('WHATSNEW.md has no entries beneath Unreleased.');

  const released = `${unreleasedHeading}\n\n## [${version}] - ${date}\n\n${unreleased}\n\n`;
  let next = `${changelog.slice(0, start)}${released}${changelog.slice(firstRelease + 1)}`;
  const previousVersion = RELEASE_HEADING.exec(changelog)?.[1];
  if (!previousVersion) throw new Error('WHATSNEW.md has no previous semantic version heading.');

  const unreleasedReference = /^\[Unreleased\]: .*$/m;
  if (!unreleasedReference.test(next)) throw new Error('WHATSNEW.md has no Unreleased comparison link.');
  next = next.replace(unreleasedReference, `[Unreleased]: https://github.com/manix84/media-renamer/compare/v${version}...HEAD`);
  const releaseReference = `[${version}]: https://github.com/manix84/media-renamer/releases/tag/v${version}`;
  next = next.replace(/(\[Unreleased\]: .*\n)/, `$1${releaseReference}\n`);
  return next;
}
