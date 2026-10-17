import type { ReleaseTags, Source } from './types';
import { applyReleaseAliases, type ReleaseTagAlias } from './releaseAliases';

const sources: Array<[RegExp, Source]> = [
  [/\b(?:blu[ ._-]?ray|b[dr]rip|bd)\b/i, 'BluRay'],
  [/\bweb[ ._-]?dl\b/i, 'WEB-DL'],
  [/\bweb[ ._-]?rip\b/i, 'WEBRip'],
  [/\bhdtv\b/i, 'HDTV'],
  [/\bdvd[ ._-]?rip\b/i, 'DVDRip'],
  [/\btv[ ._-]?rip\b/i, 'TVRip'],
];

const knownFlags = ['UNCENSORED', 'REPACK', 'REPACKED', 'PROPER', 'EXTENDED', 'REMASTERED', 'INTERNAL', 'LIMITED'];

const webOrigins: Array<{ name: string; short: string; aliases: string[] }> = [
  { name: 'Amazon', short: 'AMZN', aliases: ['AMZN', 'Amazon'] },
  { name: 'Apple TV+', short: 'ATVP', aliases: ['ATVP', 'Apple[ ._-]*TV(?:[ ._-]*Plus|\\+)?'] },
  { name: 'Crunchyroll', short: 'CR', aliases: ['CR', 'Crunchy[ ._-]*roll'] },
  { name: 'Disney+', short: 'DSNP', aliases: ['DSNP', 'Disney(?:[ ._-]*Plus|\\+)'] },
  { name: 'Hulu', short: 'HULU', aliases: ['HULU'] },
  { name: 'Max', short: 'HMAX', aliases: ['HMAX', 'HBO[ ._-]*Max'] },
  { name: 'Netflix', short: 'NF', aliases: ['NF', 'Netflix'] },
  { name: 'Paramount+', short: 'PMTP', aliases: ['PMTP', 'Paramount(?:[ ._-]*Plus|\\+)'] },
  { name: 'Peacock', short: 'PCOK', aliases: ['PCOK', 'Peacock'] },
];

const SEP = '[ ._-]+';
const movieEditionDefinitions: Array<{ canonical: string; source: string }> = [
  { canonical: 'IMAX Enhanced', source: `IMAX${SEP}Enhanced` },
  { canonical: 'HD Telesync', source: `(?:HD[ ._-]*TS|HD${SEP}Telesync)` },
  { canonical: 'HD Telecine', source: `(?:HD[ ._-]*TC|HD${SEP}Telecine)` },
  { canonical: 'HD CAM', source: `(?:HD[ ._-]*CAM(?:Rip)?|HQCAM)` },
  { canonical: 'Anniversary Edition', source: `(?:(?:\\d{1,3})(?:st|nd|rd|th)${SEP})?Anniversary${SEP}Edition` },
  { canonical: "Director's Edition", source: `Director(?:['’]?s)?${SEP}Edition` },
  { canonical: "Director's Cut", source: `Director(?:['’]?s)?${SEP}Cut` },
  { canonical: "Collector's Edition", source: `Collector(?:['’]?s)?${SEP}Edition` },
  { canonical: 'Criterion Collection', source: `Criterion${SEP}Collection` },
  { canonical: 'International Cut', source: `International${SEP}Cut` },
  { canonical: 'Roadshow Version', source: `Roadshow${SEP}Version` },
  { canonical: 'Black and White', source: `Black${SEP}and${SEP}White` },
  { canonical: 'Special Edition', source: `Special${SEP}Edition` },
  { canonical: 'Limited Edition', source: `Limited${SEP}Edition` },
  { canonical: 'Mind Bending', source: `Mind${SEP}Bending(?:${SEP}Edition)?` },
  { canonical: 'Deluxe Edition', source: `Deluxe${SEP}Edition` },
  { canonical: 'Ultimate Edition', source: `Ultimate${SEP}Edition` },
  { canonical: 'Assembly Cut', source: `Assembly${SEP}Cut` },
  { canonical: 'Theatrical Cut', source: `Theatrical(?:${SEP}(?:Edition|Cut))?` },
  { canonical: 'Final Cut', source: `Final${SEP}Cut` },
  { canonical: 'Open Matte', source: `Open${SEP}Matte` },
  { canonical: 'Fan Edit', source: `Fan${SEP}Edit` },
  { canonical: 'Remastered', source: `(?:4K${SEP})?Remaster(?:ed)?` },
  { canonical: 'Restored', source: `Restor(?:ation|ed)` },
  { canonical: 'Extended', source: `Extended(?:${SEP}Edition)?` },
  { canonical: 'CAM', source: `(?:CAMRip|CAM)` },
  { canonical: 'Telesync', source: `(?:Telesync|TS)` },
  { canonical: 'Telecine', source: `(?:Telecine|TC)` },
  { canonical: 'Workprint', source: 'Workprint' },
  { canonical: 'Unrated', source: 'Unrated' },
  { canonical: 'Uncut', source: 'Uncut' },
  { canonical: 'Redux', source: 'Redux' },
  { canonical: 'IMAX', source: 'IMAX' },
  { canonical: 'SBS', source: 'SBS' },
  { canonical: '3D', source: '3D' },
];

export function formatEditionNames(names: string[]): string | undefined {
  const unique = names.filter((name, index) => names.findIndex((candidate) => candidate.toLocaleLowerCase() === name.toLocaleLowerCase()) === index);
  if (!unique.length) return undefined;
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')}, and ${unique.at(-1)}`;
}

function canonicalMovieEdition(value: string): string | undefined {
  return movieEditionDefinitions.find((definition) => new RegExp(`^(?:${definition.source})$`, 'i').test(value.trim()))?.canonical;
}

export function normalizeMovieEditionName(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const parts = value.replace(/,\s*and\s+/ig, ',').split(/\s*,\s*|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  const canonical = parts.map(canonicalMovieEdition);
  if (canonical.some((name) => !name)) return undefined;
  return formatEditionNames(canonical as string[]);
}

const ambiguousMovieTitleEditions = new Set(['3D', 'IMAX', 'Redux', 'SBS', 'Uncut']);

export function stripTrailingMovieEdition(value: string): string | undefined {
  for (const definition of movieEditionDefinitions) {
    if (ambiguousMovieTitleEditions.has(definition.canonical)) continue;
    const match = new RegExp(`(?:[ ._-]+)(?:${definition.source})$`, 'i').exec(value.trim());
    if (match?.index) return value.slice(0, match.index).trim();
  }
  return undefined;
}

function movieSuffix(filename: string, title: string | undefined, year: number | undefined): string | undefined {
  const leaf = filename.split(/[\\/]/).at(-1)?.replace(/\.[a-z0-9]{2,5}$/i, '') ?? filename;
  if (title) {
    const tokens = title.match(/[A-Za-z0-9]+/g) ?? [];
    if (tokens.length) {
      const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const match = new RegExp(`(?<![A-Za-z0-9])${escaped.join('[^A-Za-z0-9]+')}(?![A-Za-z0-9])`, 'i').exec(leaf);
      if (match) return leaf.slice(match.index + match[0].length);
    }
  }
  if (year !== undefined) {
    const match = new RegExp(`(?<![0-9])${year}(?![0-9])`).exec(leaf);
    if (match) return leaf.slice(match.index + match[0].length);
  }
  return undefined;
}

function explicitMovieEditions(suffix: string): { names?: string[]; error?: string } | undefined {
  const markers = [...suffix.matchAll(/\{edition-([^{}]*)\}/ig)];
  const starts = [...suffix.matchAll(/\{edition\b/ig)];
  if (!starts.length) return undefined;
  if (markers.length !== starts.length || markers.some((marker) => !marker[1].trim())) return { error: 'Fix the malformed Plex edition marker.' };
  const names: string[] = [];
  for (const marker of markers) {
    const parts = marker[1].replace(/,\s*and\s+/ig, ',').split(/\s*,\s*|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      const canonical = normalizeMovieEditionName(part);
      if (!canonical) return { error: `Unsupported movie edition “${part}”.` };
      names.push(canonical);
    }
  }
  return { names };
}

export function parseMovieEdition(filename: string, title?: string, year?: number): { edition?: string; error?: string } {
  const suffix = movieSuffix(filename, title, year);
  if (suffix === undefined) return {};
  const explicit = explicitMovieEditions(suffix);
  if (explicit?.error) return { error: explicit.error };
  if (explicit?.names) return { edition: formatEditionNames(explicit.names) };
  const candidates = movieEditionDefinitions.flatMap((definition) => [...suffix.matchAll(new RegExp(`(?<![A-Za-z0-9])(?:${definition.source})(?![A-Za-z0-9])`, 'gi'))].map((match) => ({
    canonical: definition.canonical,
    index: match.index,
    end: match.index + match[0].length,
  })));
  const accepted: typeof candidates = [];
  for (const candidate of candidates.sort((left, right) => left.index - right.index || (right.end - right.index) - (left.end - left.index))) {
    if (!accepted.some((existing) => candidate.index < existing.end && candidate.end > existing.index)) accepted.push(candidate);
  }
  return { edition: formatEditionNames(accepted.sort((left, right) => left.index - right.index).map((candidate) => candidate.canonical)) };
}

export function parseExplicitEdition(value: string): { edition?: string; error?: string } {
  const markers = [...value.matchAll(/\{edition-([^{}]*)\}/ig)];
  const starts = [...value.matchAll(/\{edition\b/ig)];
  if (!starts.length) return {};
  if (markers.length !== starts.length || markers.some((marker) => !marker[1].trim())) return { error: 'Fix the malformed Plex edition marker.' };
  const unique = [...new Map(markers.map((marker) => [marker[1].trim().toLocaleLowerCase(), marker[1].trim()])).values()];
  if (unique.length > 1) return { error: `Conflicting Plex editions: ${unique.join(' and ')}.` };
  return { edition: unique[0] };
}

export function stripEditionTokens(value: string): string {
  return value.replace(/\{edition-[^}]+\}/ig, ' ');
}

function detectWebOrigin(evidence: string, source: Source): { webOrigin?: string; webOriginShort?: string } {
  if (source !== 'WEB-DL' && source !== 'WEBRip') return {};
  const origin = webOrigins.find((candidate) => candidate.aliases.some((alias) => new RegExp(`(?<![A-Za-z0-9])(?:${alias})(?![A-Za-z0-9])`, 'i').test(evidence)));
  return origin ? { webOrigin: origin.name, webOriginShort: origin.short } : {};
}

function detectReleaseGroup(stem: string, source: Source, resolution?: string, videoCodec?: string): string | undefined {
  const trailing = stem.match(/-([A-Za-z0-9][A-Za-z0-9._]{1,31})$/)?.[1];
  if (trailing && (source !== 'Unknown' || resolution || videoCodec) && !/^(?:DL|Rip|WEB|BluRay|BRRip|BDRip|HDTV|x26[45]|h26[45]|HEVC|AV1)$/i.test(trailing)) return trailing;
  const leading = stem.match(/^\[([^\]]{1,32})\][ ._-]*/)?.[1]?.trim();
  return leading && !/^(?:2160p|1080p|720p|576p|480p|WEB-DL|WEBRip|BluRay|AAC|DTS)$/i.test(leading) ? leading : undefined;
}

export function parseReleaseTags(filename: string, aliases: ReleaseTagAlias[] = []): ReleaseTags {
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
  const group = detectReleaseGroup(stem, source, resolution, videoCodec);
  const webOrigin = detectWebOrigin(evidence, source);
  const explicitEdition = parseExplicitEdition(evidence);

  return applyReleaseAliases(evidence, {
    source,
    edition: explicitEdition.edition,
    editionError: explicitEdition.error,
    resolution,
    videoCodec,
    audioCodec: audio?.[1].toUpperCase(),
    channels: audio?.[2]?.replace(' ', '.'),
    flags: [...new Set(flags.map((flag) => flag === 'REPACKED' ? 'REPACK' : flag))],
    group,
    ...webOrigin,
  }, aliases);
}

export function applyReleaseOverrides(tags: ReleaseTags, overrides: { source?: Source; aiUpscale?: boolean }): ReleaseTags {
  const flags = tags.flags.filter((flag) => flag !== 'AI Upscale');
  if (overrides.aiUpscale ?? tags.flags.includes('AI Upscale')) flags.push('AI Upscale');
  return { ...tags, source: overrides.source ?? tags.source, flags };
}
