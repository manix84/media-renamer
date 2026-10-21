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

  it('plays the four-note Halloween phrase at 400 BPM', () => {
    const tones = completionChimeTones('halloween');

    expect(tones.map((tone) => tone.frequency)).toEqual([261.63, 293.66, 329.63, 349.23]);
    expect(tones.map((tone) => tone.start)).toEqual([0, .15, .3, .45]);
    expect(tones.map((tone) => tone.duration)).toEqual([.15, .15, .15, .15]);
  });
});
