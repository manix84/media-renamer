import type { ReleaseTags, Source } from './types';

const sources: Array<[RegExp, Source]> = [
  [/\b(?:blu[ ._-]?ray|b[dr]rip)\b/i, 'BluRay'],
  [/\bweb[ ._-]?dl\b/i, 'WEB-DL'],
  [/\bweb[ ._-]?rip\b/i, 'WEBRip'],
  [/\bhdtv\b/i, 'HDTV'],
  [/\bdvd[ ._-]?rip\b/i, 'DVDRip'],
  [/\btv[ ._-]?rip\b/i, 'TVRip'],
];

const knownFlags = ['UNCENSORED', 'REPACK', 'REPACKED', 'PROPER', 'EXTENDED', 'REMASTERED', 'INTERNAL', 'LIMITED'];

export function parseReleaseTags(filename: string): ReleaseTags {
  const stem = filename.replace(/\.[a-z0-9]{2,5}$/i, '');
  const source = sources.find(([pattern]) => pattern.test(stem))?.[1] ?? 'Unknown';
  const resolution = stem.match(/\b(2160p|1080p|720p|576p|480p)\b/i)?.[1];
  const videoCodec = stem.match(/\b(x265|x264|h[ ._-]?265|hevc|h[ ._-]?264|av1)\b/i)?.[1].replace(/[ ._-]/g, '');
  const audio = stem.match(/\b(DDP?|EAC3|AC3|AAC|DTS(?:-HD)?|TrueHD|FLAC)[ ._-]?(\d[ .]\d)?\b/i);
  const flags = knownFlags.filter((flag) => new RegExp(`\\b${flag}\\b`, 'i').test(stem));
  const group = stem.match(/-([A-Za-z0-9]+)$/)?.[1];

  return {
    source,
    resolution,
    videoCodec,
    audioCodec: audio?.[1].toUpperCase(),
    channels: audio?.[2]?.replace(' ', '.'),
    flags: [...new Set(flags.map((flag) => flag === 'REPACKED' ? 'REPACK' : flag))],
    group,
  };
}
