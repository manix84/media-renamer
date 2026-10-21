import type { ReleaseTags, Source } from './types';

export type ReleaseAliasField = 'source' | 'resolution' | 'videoCodec' | 'audioCodec' | 'channels' | 'flag' | 'webOrigin' | 'edition';
export type ReleaseTagAlias = { field: ReleaseAliasField; match: string; value: string; short?: string };
export type ParsedReleaseAliases = { aliases: ReleaseTagAlias[]; errors: string[] };

const fields = new Set<ReleaseAliasField>(['source', 'resolution', 'videoCodec', 'audioCodec', 'channels', 'flag', 'webOrigin', 'edition']);
const sources = new Set<Source>(['BluRay', 'DVD', 'WEB-DL', 'WEBRip', 'HDTV', 'DVDRip', 'TVRip', 'Unknown']);

export function parseReleaseAliasText(text: string): ParsedReleaseAliases {
  const aliases: ReleaseTagAlias[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const match = /^(source|resolution|videoCodec|audioCodec|channels|flag|webOrigin|edition)\s*=\s*([^=]+?)\s*=>\s*([^|]+?)(?:\s*\|\s*(.+))?$/i.exec(line);
    if (!match) { errors.push(`Line ${index + 1}: use field = alias => output.`); return; }
    const field = [...fields].find((candidate) => candidate.toLowerCase() === match[1].toLowerCase());
    const alias = match[2].trim();
    const value = match[3].trim();
    const short = match[4]?.trim();
    if (!field || !alias || !value || /[{}]/.test(alias)) { errors.push(`Line ${index + 1}: alias and output must be nonempty and cannot contain braces.`); return; }
    if (field === 'source' && !sources.has(value as Source)) { errors.push(`Line ${index + 1}: “${value}” is not a supported source.`); return; }
    if (field === 'webOrigin' && short === '') { errors.push(`Line ${index + 1}: web-origin shorthand cannot be empty.`); return; }
    aliases.push({ field, match: alias, value, ...(short ? { short } : {}) });
  });
  return { aliases, errors };
}

function aliasPattern(alias: string): RegExp {
  const parts = alias.split(/[ ._-]+/).filter(Boolean).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![A-Za-z0-9])${parts.join('[ ._-]+')}(?![A-Za-z0-9])`, 'i');
}

export function applyReleaseAliases(evidence: string, detected: ReleaseTags, aliases: ReleaseTagAlias[]): ReleaseTags {
  const result: ReleaseTags = { ...detected, flags: [...detected.flags] };
  for (const alias of aliases) {
    if (!aliasPattern(alias.match).test(evidence)) continue;
    if (alias.field === 'edition') continue;
    if (alias.field === 'flag') result.flags.push(alias.value);
    else if (alias.field === 'source') result.source = alias.value as Source;
    else if (alias.field === 'webOrigin') { result.webOrigin = alias.value; result.webOriginShort = alias.short; }
    else result[alias.field] = alias.value;
  }
  result.flags = [...new Map(result.flags.map((flag) => [flag.toLocaleLowerCase(), flag])).values()];
  if (result.source !== 'WEB-DL' && result.source !== 'WEBRip') { delete result.webOrigin; delete result.webOriginShort; }
  return result;
}

export function matchingEditionAliases(evidence: string, aliases: ReleaseTagAlias[]): Array<{ value: string; index: number }> {
  return aliases.filter((alias) => alias.field === 'edition').flatMap((alias) => {
    const match = aliasPattern(alias.match).exec(evidence);
    return match ? [{ value: alias.value, index: match.index }] : [];
  });
}
