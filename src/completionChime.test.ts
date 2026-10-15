import { describe, expect, it } from 'vitest';
import { completionChimeTones } from './completionChime';

describe('completion chimes', () => {
  it('uses the standard chime for ordinary colour palettes', () => {
    expect(completionChimeTones('classic')).toEqual(completionChimeTones('ocean'));
  });

  it('gives seasonal themes distinct chimes', () => {
    const standard = completionChimeTones('classic');
    expect(completionChimeTones('halloween')).not.toEqual(standard);
    expect(completionChimeTones('christmas')).not.toEqual(standard);
    expect(completionChimeTones('christmas')).not.toEqual(completionChimeTones('halloween'));
  });
});
