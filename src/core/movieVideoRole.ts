export type MovieVideoRole =
  | { kind: 'main' }
  | { kind: 'multipart'; part: number }
  | { kind: 'extra'; extraType: 'trailer' | 'featurette' | 'behindthescenes' | 'deleted' | 'interview' | 'scene' | 'short' | 'other' }
  | { kind: 'sample' };

const multipartToken = /(?:^|[ ._-])(?:cd|disc|disk|part|pt)[ ._-]*(\d{1,2})(?=$|[ ._-])/i;
const extraTokens: Array<[Extract<MovieVideoRole, { kind: 'extra' }>['extraType'], RegExp]> = [
  ['trailer', /(?:^|[ ._-])trailers?(?=$|[ ._-])/i],
  ['featurette', /(?:^|[ ._-])featurettes?(?=$|[ ._-])/i],
  ['behindthescenes', /(?:^|[ ._-])behind[ ._-]*(?:the[ ._-]*)?scenes?(?=$|[ ._-])/i],
  ['deleted', /(?:^|[ ._-])deleted[ ._-]*scenes?(?=$|[ ._-])/i],
  ['interview', /(?:^|[ ._-])interviews?(?=$|[ ._-])/i],
  ['scene', /(?:^|[ ._-])scenes?(?=$|[ ._-])/i],
  ['short', /(?:^|[ ._-])shorts?(?=$|[ ._-])/i],
];

function filenameStem(filePath: string): string {
  const filename = filePath.split(/[\\/]/).pop() ?? filePath;
  return filename.replace(/\.[^.]+$/, '');
}

function parentParts(filePath: string): string[] {
  return filePath.split(/[\\/]/).slice(0, -1).map((part) => part.toLocaleLowerCase());
}

function multipartEvidence(filePath: string): { part: number; key: string } | undefined {
  const stem = filenameStem(filePath);
  const match = stem.match(multipartToken);
  if (!match) return undefined;
  return {
    part: Number(match[1]),
    key: stem.replace(multipartToken, ' ').replace(/[ ._-]+/g, ' ').trim().toLocaleLowerCase(),
  };
}

export function classifyMovieVideoRoles(paths: string[]): Record<string, MovieVideoRole> {
  const roles: Record<string, MovieVideoRole> = Object.fromEntries(paths.map((path) => [path, { kind: 'main' }]));
  const multipartGroups = new Map<string, Array<{ path: string; part: number }>>();
  for (const path of paths) {
    const stem = filenameStem(path);
    const parents = parentParts(path);
    if (/(?:^|[ ._-])sample(?=$|[ ._-])/i.test(stem) || parents.some((part) => /^samples?$/.test(part))) {
      roles[path] = { kind: 'sample' };
      continue;
    }
    const extra = extraTokens.find(([, pattern]) => pattern.test(stem) || parents.some((part) => pattern.test(part)));
    if (extra) {
      roles[path] = { kind: 'extra', extraType: extra[0] };
      continue;
    }
    if (parents.some((part) => /^(?:extras?|other)$/.test(part))) {
      roles[path] = { kind: 'extra', extraType: 'other' };
      continue;
    }
    const multipart = multipartEvidence(path);
    if (multipart) multipartGroups.set(multipart.key, [...(multipartGroups.get(multipart.key) ?? []), { path, part: multipart.part }]);
  }
  for (const group of multipartGroups.values()) {
    if (group.length < 2 || new Set(group.map((item) => item.part)).size < 2) continue;
    for (const item of group) roles[item.path] = { kind: 'multipart', part: item.part };
  }
  return roles;
}

export function movieVideoSuffix(role: MovieVideoRole): string {
  if (role.kind === 'multipart') return ` - cd${role.part}`;
  if (role.kind === 'extra') return `-${role.extraType}`;
  return '';
}

export function appendMovieVideoSuffix(filename: string, role: MovieVideoRole): string {
  const suffix = movieVideoSuffix(role);
  if (!suffix) return filename;
  const extension = filename.match(/(\.[^.]+)$/)?.[1] ?? '';
  return `${extension ? filename.slice(0, -extension.length) : filename}${suffix}${extension}`;
}

export function stripMovieVideoRoleTokens(value: string, role: MovieVideoRole): string {
  const stripped = role.kind === 'multipart' ? value.replace(multipartToken, ' ')
    : role.kind === 'extra' ? value.replace(extraTokens.find(([type]) => type === role.extraType)?.[1] ?? /$^/, ' ')
      : value;
  return stripped
    .replace(/[ ._-]+/g, ' ')
    .trim();
}
