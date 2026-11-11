import { describe, expect, it } from 'vitest';
import { windowChromeOptions } from './windowChrome';

describe('windowChromeOptions', () => {
  it('keeps native inset traffic lights on macOS', () => {
    expect(windowChromeOptions('darwin')).toEqual({ titleBarStyle: 'hiddenInset' });
  });

  it.each(['win32', 'linux'] as const)('enables live window-controls overlay geometry on %s', (platform) => {
    expect(windowChromeOptions(platform)).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#0a0d14', symbolColor: '#828b9e', height: 64 },
    });
  });
});
