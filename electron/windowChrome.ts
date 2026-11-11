import type { BrowserWindowConstructorOptions } from 'electron';

export type WindowChromeOptions = Pick<BrowserWindowConstructorOptions, 'titleBarStyle' | 'titleBarOverlay'>;

export function windowChromeOptions(platform: NodeJS.Platform): WindowChromeOptions {
  if (platform === 'darwin') return { titleBarStyle: 'hiddenInset' };
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0d14',
      symbolColor: '#828b9e',
      height: 64,
    },
  };
}
