import { describe, expect, it } from 'vitest';
import { createRenamePlan, filenameProblem } from './renamePlan';

describe('rename plan', () => {
  it('builds sibling destinations and counts ready items', () => {
    const plan = createRenamePlan([{ sourcePath: '/shows/Old.mkv', targetName: 'Show - S01E01 - Pilot.mkv', matchStatus: 'confident', confidence: .95 }]);
    expect(plan.items[0].targetPath).toBe('/shows/Show - S01E01 - Pilot.mkv');
    expect(plan.readyCount).toBe(1);
    expect(plan.blockedCount).toBe(0);
  });

  it('targets a configured destination directory and records it for creation', () => {
    const plan = createRenamePlan([{ sourcePath: '/incoming/Old.mkv', targetDirectory: '/library/Show (2026)', targetName: 'Show - S01E01.mkv', matchStatus: 'confident', confidence: .95 }]);
    expect(plan.items[0].targetPath).toBe('/library/Show (2026)/Show - S01E01.mkv');
    expect(plan.destinationDirectories).toEqual(['/library/Show (2026)']);
  });

  it('blocks invalid destination configuration instead of falling back to the source folder', () => {
    const plan = createRenamePlan([{ sourcePath: '/incoming/Old.mkv', targetName: 'New.mkv', targetDirectory: '/library', configurationError: 'Fix the show folder pattern.', matchStatus: 'confident', confidence: .95 }]);
    expect(plan.items[0].targetPath).toBeUndefined();
    expect(plan.issues[0].code).toBe('invalid-destination');
  });

  it('plans companion files with preserved language and role suffixes', () => {
    const plan = createRenamePlan([{
      sourcePath: '/incoming/Old.mkv', targetDirectory: '/library/Show', targetName: 'Show - S01E01.mkv', matchStatus: 'confident', confidence: 1,
      companions: [
        { path: '/incoming/Old.en.forced.srt', suffix: '.en.forced.srt', kind: 'subtitle' },
        { path: '/incoming/Old-thumb.jpg', suffix: '-thumb.jpg', kind: 'artwork' },
      ],
    }]);
    expect(plan.items[0].companions.map((item) => item.targetPath)).toEqual([
      '/library/Show/Show - S01E01.en.forced.srt',
      '/library/Show/Show - S01E01-thumb.jpg',
    ]);
  });

  it('blocks a video with an ambiguous companion', () => {
    const plan = createRenamePlan([{ sourcePath: '/incoming/Old.mkv', targetName: 'New.mkv', matchStatus: 'confident', confidence: 1, companionError: 'A subtitle could belong to more than one video.' }]);
    expect(plan.blockedCount).toBe(1);
    expect(plan.issues.some((issue) => issue.code === 'ambiguous-companion')).toBe(true);
  });

  it('blocks unresolved and duplicate destinations case-insensitively', () => {
    const plan = createRenamePlan([
      { sourcePath: '/shows/one.mkv', targetName: 'Same.mkv', matchStatus: 'confident', confidence: .9 },
      { sourcePath: '/shows/two.mkv', targetName: 'same.mkv', matchStatus: 'confident', confidence: .9 },
      { sourcePath: '/shows/three.mkv', matchStatus: 'unmatched', confidence: 0 },
    ]);
    expect(plan.blockedCount).toBe(3);
    expect(plan.issues.filter((entry) => entry.code === 'duplicate-target')).toHaveLength(2);
    expect(plan.issues.some((entry) => entry.code === 'unresolved-match')).toBe(true);
  });

  it('blocks matches that still require review', () => {
    const plan = createRenamePlan([{ sourcePath: '/shows/Old.mkv', targetName: 'New.mkv', matchStatus: 'review', confidence: .6 }]);
    expect(plan.blockedCount).toBe(1);
    expect(plan.issues[0].code).toBe('review-required');
  });

  it('warns for no-op and case-only renames', () => {
    const plan = createRenamePlan([
      { sourcePath: '/shows/Same.mkv', targetName: 'Same.mkv', matchStatus: 'confident', confidence: 1 },
      { sourcePath: '/shows/UPPER.mkv', targetName: 'upper.mkv', matchStatus: 'confident', confidence: 1 },
    ]);
    expect(plan.warningCount).toBe(2);
    expect(plan.issues.map((entry) => entry.code)).toEqual(['no-change', 'case-only-rename']);
  });

  it('rejects portable filename hazards', () => {
    expect(filenameProblem('bad:name.mkv')).toMatch(/invalid/);
    expect(filenameProblem('trailing.')).toMatch(/space or period/);
    expect(filenameProblem('CON.mkv')).toMatch(/reserved/);
    expect(filenameProblem('Good Name.mkv')).toBeUndefined();
  });
});
