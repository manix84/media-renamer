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
    const parsed = parseReleaseAliasText('source = shiny => LaserDisc\nbroken line');
    expect(parsed.errors).toHaveLength(2);
    const { aliases } = parseReleaseAliasText('flag = TS => Telesync');
    expect(parseReleaseTags('Show.DTS-HD.mkv', aliases).flags).not.toContain('Telesync');
  });
});
