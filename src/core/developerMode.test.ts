import { describe, expect, it } from 'vitest';
import { DEVELOPER_UNLOCK_CLICKS, registerDeveloperVersionClick } from './developerMode';

describe('developer mode unlock', () => {
  it('starts the remaining-click hint after the third click', () => {
    expect(registerDeveloperVersionClick(1)).toMatchObject({ clicks: 2, showHint: false, remaining: 5 });
    expect(registerDeveloperVersionClick(2)).toMatchObject({ clicks: 3, showHint: true, remaining: 4 });
  });

  it('unlocks on the seventh click and stays unlocked', () => {
    expect(registerDeveloperVersionClick(DEVELOPER_UNLOCK_CLICKS - 1)).toEqual({ clicks: 7, remaining: 0, showHint: false, unlocked: true });
    expect(registerDeveloperVersionClick(0, true)).toEqual({ clicks: 7, remaining: 0, showHint: false, unlocked: true });
  });
});
