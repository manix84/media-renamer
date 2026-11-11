import { describe, expect, it } from 'vitest';
import { classifyRelease, nextVersion, releaseCommitVersion, updateWhatsNew } from './release-automation.mjs';

describe('semantic release automation', () => {
  it('maps breaking, feature, removal, and maintenance commits to semantic bumps', () => {
    expect(classifyRelease([{ subject: 'feat!: replace extension API' }])).toBe('major');
    expect(classifyRelease([{ subject: 'refactor: extension API', body: 'BREAKING CHANGE: manifests now use API 2' }])).toBe('major');
    expect(classifyRelease([{ subject: 'feat(ui): add compact mode' }])).toBe('minor');
    expect(classifyRelease([{ subject: 'Remove legacy provider option' }])).toBe('minor');
    expect(classifyRelease([{ subject: 'fix: preserve preferences' }])).toBe('patch');
  });

  it('increments semantic versions', () => {
    expect(nextVersion('1.2.3', 'major')).toBe('2.0.0');
    expect(nextVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(nextVersion('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('recognizes release commits', () => {
    expect(releaseCommitVersion('chore(release): v1.4.0')).toBe('1.4.0');
    expect(releaseCommitVersion('chore: release')).toBeUndefined();
  });

  it('moves Unreleased notes into a dated release and updates links', () => {
    const changelog = `# What's New\n\n## [Unreleased]\n\n### Added\n\n- A feature.\n\n## [1.2.3] - 2026-11-01\n\n- Previous.\n\n[Unreleased]: https://github.com/manix84/media-renamer/compare/v1.2.3...HEAD\n[1.2.3]: https://github.com/manix84/media-renamer/releases/tag/v1.2.3\n`;
    const result = updateWhatsNew(changelog, '1.3.0', '2026-11-11');
    expect(result).toContain('## [Unreleased]\n\n## [1.3.0] - 2026-11-11\n\n### Added');
    expect(result).toContain('[Unreleased]: https://github.com/manix84/media-renamer/compare/v1.3.0...HEAD');
    expect(result).toContain('[1.3.0]: https://github.com/manix84/media-renamer/releases/tag/v1.3.0');
  });
});
