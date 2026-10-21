export const DEVELOPER_UNLOCK_CLICKS = 7;
export const DEVELOPER_HINT_START_CLICK = 3;

export type DeveloperClickResult = {
  clicks: number;
  remaining: number;
  showHint: boolean;
  unlocked: boolean;
};

export function registerDeveloperVersionClick(currentClicks: number, alreadyUnlocked = false): DeveloperClickResult {
  if (alreadyUnlocked) return { clicks: DEVELOPER_UNLOCK_CLICKS, remaining: 0, showHint: false, unlocked: true };
  const clicks = Math.min(DEVELOPER_UNLOCK_CLICKS, Math.max(0, currentClicks) + 1);
  const remaining = DEVELOPER_UNLOCK_CLICKS - clicks;
  return {
    clicks,
    remaining,
    showHint: clicks >= DEVELOPER_HINT_START_CLICK && remaining > 0,
    unlocked: remaining === 0,
  };
}
