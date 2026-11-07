import { describe, expect, it } from 'vitest';
import { parseReleaseTags } from './releaseTags';
import { parseReleaseAliasText } from './releaseAliases';

describe('custom release-tag aliases', () => {
  it('parses documented alias lines and ignores comments', () => {
    const parsed = parseReleaseAliasText('# Personal vocabulary\nsource = web download => WEB-DL\nvideoCodec = AVC => H.264\nwebOrigin = crunchy roll premium => Crunchyroll | CR');
    expect(parsed.errors).toEqual([]);
    expect(parsed.aliases).toHaveLength(3);
  });

  it('applies separator-tolerant aliases to detected tags', () => {
    const { aliases } = parseReleaseAliasText('source = web download => WEB-DL\nvideoCodec = AVC => H.264\nflag = dual audio => Dual Audio\nwebOrigin = crunchy premium => Crunchyroll | CR');
    expect(parseReleaseTags('Show.S01E01.web-download.crunchy_premium.AVC.dual-audio.mkv', aliases)).toMatchObject({
      source: 'WEB-DL', videoCodec: 'H.264', webOrigin: 'Crunchyroll', webOriginShort: 'CR', flags: ['Dual Audio'],
    });
  });

  it('requires complete tokens and reports malformed or unsupported lines', () => {
    const parsed = parseReleaseAliasText('source = shiny => Betamax\nbroken line');
    expect(parsed.errors).toHaveLength(2);
    const { aliases } = parseReleaseAliasText('flag = TS => Telesync');
    expect(parseReleaseTags('Show.DTS-HD.mkv', aliases).flags).not.toContain('Telesync');
  });

  it('accepts aliases targeting extended source types', () => {
    const { aliases, errors } = parseReleaseAliasText('source = satellite encode => DSRip\nsource = laser transfer => LaserDisc');
    expect(errors).toEqual([]);
    expect(parseReleaseTags('Show.satellite-encode.mkv', aliases).source).toBe('DSRip');
    expect(parseReleaseTags('Movie.laser-transfer.mkv', aliases).source).toBe('LaserDisc');
  });

  it('accepts saved movie edition aliases', () => {
    expect(parseReleaseAliasText('edition = mindbending => Mind Bending')).toEqual({
      aliases: [{ field: 'edition', match: 'mindbending', value: 'Mind Bending' }], errors: [],
    });
  });
});
