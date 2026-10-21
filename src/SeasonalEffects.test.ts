import { describe, expect, it } from 'vitest';
import { createBatFlights, hasSeasonalCanvasEffects } from './SeasonalEffects';

describe('Halloween bat flights', () => {
  it('enter and leave through different screen edges with curved interior routes', () => {
    const values = [.05, .4, .25, .2, .75, .8, .6, .3, .5, .9, .15, .7];
    let index = 0;
    const [flight] = createBatFlights(1000, 700, 1, () => values[index++ % values.length]);
    const outside = (point: { x: number; y: number }) => point.x < 0 || point.x > 1000 || point.y < 0 || point.y > 700;

    expect(outside(flight.start)).toBe(true);
    expect(outside(flight.end)).toBe(true);
    expect(flight.exitEdge).toBe((flight.entryEdge + 2) % 4);
    expect(flight.exitEdge).not.toBe(flight.entryEdge);
    expect(flight.start).not.toEqual(flight.end);
    expect(flight.control1.x).toBeGreaterThan(0);
    expect(flight.control1.y).toBeGreaterThan(0);
    expect(flight.control2.x).toBeLessThan(1000);
    expect(flight.control2.y).toBeLessThan(700);
  });
});

describe('seasonal canvas effects', () => {
  it('covers particle themes while leaving Pride to its CSS colour flow', () => {
    expect(['valentines', 'bonfire', 'new-year', 'spring', 'summer', 'autumn', 'winter', 'halloween', 'christmas'].every((palette) => hasSeasonalCanvasEffects(palette as Parameters<typeof hasSeasonalCanvasEffects>[0]))).toBe(true);
    expect(hasSeasonalCanvasEffects('pride')).toBe(false);
    expect(hasSeasonalCanvasEffects('classic')).toBe(false);
  });
});
