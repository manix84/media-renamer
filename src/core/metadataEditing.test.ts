import { describe, expect, it } from 'vitest';
import { optionalMetadataNumber, validateMediaMetadata, type MediaMetadataOverride } from './metadataEditing';

function metadata(overrides: Partial<MediaMetadataOverride> = {}): MediaMetadataOverride {
  return {
    name: 'Example', year: '2026', providerId: '123', episodes: [], edition: '', resolution: '1080p', source: 'WEB-DL',
    videoCodec: 'H.264', audioCodec: 'AAC', channels: '2.0', webOrigin: '', webOriginShort: '', group: '', flags: '', ...overrides,
  };
}

describe('media metadata editing', () => {
  it('accepts valid movie and episode metadata', () => {
    expect(validateMediaMetadata(metadata(), true)).toBeUndefined();
    expect(validateMediaMetadata(metadata({ episodes: [{ id: 'episode', season: '0', number: '1', title: 'Special' }] }), false)).toBeUndefined();
  });

  it('requires identity fields and validates provider values', () => {
    expect(validateMediaMetadata(metadata({ name: ' ' }), true)).toBe('Movie title is required.');
    expect(validateMediaMetadata(metadata({ year: '26' }), true)).toContain('four-digit year');
    expect(validateMediaMetadata(metadata({ providerId: 'tmdb-123' }), true)).toContain('TMDB ID');
    expect(validateMediaMetadata(metadata({ edition: '{bad}' }), true)).toContain('braces');
  });

  it('validates each edited TV episode', () => {
    expect(validateMediaMetadata(metadata({ episodes: [{ id: 'episode', season: '-1', number: '1', title: 'Special' }] }), false)).toContain('seasons');
    expect(validateMediaMetadata(metadata({ episodes: [{ id: 'episode', season: '1', number: '0', title: 'Pilot' }] }), false)).toContain('numbers');
    expect(validateMediaMetadata(metadata({ episodes: [{ id: 'episode', season: '1', number: '1', title: ' ' }] }), false)).toContain('title');
  });

  it('converts optional numeric fields without inventing zero', () => {
    expect(optionalMetadataNumber(' 1990 ')).toBe(1990);
    expect(optionalMetadataNumber('')).toBeUndefined();
  });
});
