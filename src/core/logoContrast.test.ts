import { describe, expect, it } from 'vitest';
import { logoShadowForPixels } from './logoContrast';

function pixels(...colours: Array<[number, number, number, number?]>): Uint8ClampedArray {
  return new Uint8ClampedArray(colours.flatMap(([red, green, blue, alpha = 255]) => [red, green, blue, alpha]));
}

describe('logoShadowForPixels', () => {
  it('ignores transparent pixels when measuring contrast', () => {
    expect(logoShadowForPixels(pixels([255, 255, 255, 0], [10, 10, 10]), .92)).toBe('none');
  });

  it('adds a dark outline only when a light logo disappears on a light background', () => {
    expect(logoShadowForPixels(pixels([250, 250, 250], [245, 245, 245], [20, 20, 20]), .92)).toBe('dark');
  });

  it('adds a light outline when a dark logo disappears on a dark background', () => {
    expect(logoShadowForPixels(pixels([4, 4, 4], [12, 12, 12], [220, 220, 220]), .015)).toBe('light');
  });

  it('does not decorate a logo whose visible pixels already contrast', () => {
    expect(logoShadowForPixels(pixels([5, 5, 5], [185, 24, 38], [20, 20, 20]), .92)).toBe('none');
    expect(logoShadowForPixels(pixels([245, 245, 245], [75, 160, 230], [230, 230, 230]), .015)).toBe('none');
  });

  it('does not add an outline for a balanced mixed-contrast image', () => {
    expect(logoShadowForPixels(pixels([250, 250, 250], [250, 250, 250], [10, 10, 10], [10, 10, 10]), .92)).toBe('none');
  });
});
