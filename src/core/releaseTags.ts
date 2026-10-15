import type { ReleaseTags, Source } from './types';

const sources: Array<[RegExp, Source]> = [
  [/\b(?:blu[ ._-]?ray|b[dr]rip|bd)\b/i, 'BluRay'],
  [/\bweb[ ._-]?dl\b/i, 'WEB-DL'],
  [/\bweb[ ._-]?rip\b/i, 'WEBRip'],
  [/\bhdtv\b/i, 'HDTV'],
  [/\bdvd[ ._-]?rip\b/i, 'DVDRip'],
  [/\btv[ ._-]?rip\b/i, 'TVRip'],
];

const knownFlags = ['UNCENSORED', 'REPACK', 'REPACKED', 'PROPER', 'EXTENDED', 'REMASTERED', 'INTERNAL', 'LIMITED'];

export function parseReleaseTags(filename: string): ReleaseTags {
  const leaf = filename.split(/[\\/]/).at(-1) ?? filename;
  const stem = leaf.replace(/\.[a-z0-9]{2,5}$/i, '');
  const evidence = filename.replace(/\.[a-z0-9]{2,5}$/i, '');
  const source = sources.find(([pattern]) => pattern.test(evidence))?.[1] ?? 'Unknown';
  const resolution = evidence.match(/\b(2160p|1080p|720p|576p|480p)\b/i)?.[1];
  const videoCodec = evidence.match(/\b(x265|x264|h[ ._-]?265|hevc|h[ ._-]?264|av1)\b/i)?.[1].replace(/[ ._-]/g, '');
  const audio = evidence.match(/\b(DDP?|EAC3|AC3|AAC|DTS(?:-HD)?|TrueHD|FLAC)[ ._-]?(\d[ .]\d)?\b/i);
  const flags = knownFlags.filter((flag) => new RegExp(`\\b${flag}\\b`, 'i').test(evidence));
  const animeVersion = evidence.match(/(?:\bS\d{1,3}E\d{1,4}|\b\d{1,3}x\d{1,4})v(\d+)\b/i)?.[1];
  if (animeVersion && Number(animeVersion) >= 2) flags.push('REPACK');
  if (/\bai[ ._-]*upscal(?:e|ed)\b/i.test(evidence)) flags.push('AI Upscale');
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

export function applyReleaseOverrides(tags: ReleaseTags, overrides: { source?: Source; aiUpscale?: boolean }): ReleaseTags {
  const flags = tags.flags.filter((flag) => flag !== 'AI Upscale');
  if (overrides.aiUpscale ?? tags.flags.includes('AI Upscale')) flags.push('AI Upscale');
  return { ...tags, source: overrides.source ?? tags.source, flags };
}
