import { describe, expect, it } from 'vitest';
import { completionChimeTones } from './completionChime';

describe('completion chimes', () => {
  it('uses the standard chime for ordinary colour palettes', () => {
    expect(completionChimeTones('classic')).toEqual(completionChimeTones('ocean'));
  });

  it('gives seasonal themes distinct chimes', () => {
    const standard = completionChimeTones('classic');
    const seasonalPalettes = [
      'valentines', 'pride', 'bonfire', 'new-year', 'spring',
      'summer', 'autumn', 'winter', 'halloween', 'christmas',
    ] as const;
    const seasonalChimes = seasonalPalettes.map((palette) => completionChimeTones(palette));

    expect(seasonalChimes.every((chime) => JSON.stringify(chime) !== JSON.stringify(standard))).toBe(true);
    expect(new Set(seasonalChimes.map((chime) => JSON.stringify(chime))).size).toBe(seasonalPalettes.length);
  });

  it('plays the requested Deck the Halls phrase for Christmas', () => {
    expect(completionChimeTones('christmas').map((tone) => tone.frequency)).toEqual([
      523.25, 493.88, 440, 392, 349.23, 392, 440, 349.23,
    ]);
  });

  it('plays the Halloween phrase followed by two clicks', () => {
    const tones = completionChimeTones('halloween');

    expect(tones.slice(0, 8).map((tone) => tone.frequency)).toEqual([
      261.63, 349.23, 440, 349.23, 261.63, 466.16, 392, 329.63,
    ]);
    expect(tones.slice(8)).toEqual([
      { frequency: 1800, start: 1.24, duration: .025, gain: .075, wave: 'square' },
      { frequency: 1800, start: 1.43, duration: .025, gain: .075, wave: 'square' },
    ]);
  });
});
