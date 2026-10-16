import { describe, expect, it } from 'vitest';
import { classifyMediaBatch } from './mediaClassification';

describe('media batch classification', () => {
  it('recognises a movie from its title, year, and release suffix', () => {
    expect(classifyMediaBatch(['28.Years.Later.The.Bone.Temple.2026.1080p.WEBRip.x265.10bit.AAC5.1.mkv'], 2026)).toBe('movies');
  });

  it.each([
    ['The Great British Bake Off S17E04 Bread Week 1080p WEB-DL.mkv'],
    ['Jackie Chan Adventures_S03_03.mp4'],
    ["[Doomdos] - Marika's Love Meter Malfunction - 07 [1080p].mkv"],
    ['Some Show OVA01 1080p.mkv'],
  ])('recognises TV episode evidence in %s', (filename) => {
    expect(classifyMediaBatch([filename], 2026)).toBe('shows');
  });

  it('prefers explicit episode evidence when a show title contains a year', () => {
    expect(classifyMediaBatch(['Doctor.Who.2005.S01E01.1080p.mkv'], 2026)).toBe('shows');
  });

  it('leaves an unstructured batch unchanged', () => {
    expect(classifyMediaBatch(['Family Holiday.mkv', 'Camera Export.mp4'], 2026)).toBeUndefined();
  });
});
