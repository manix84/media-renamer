import fs from 'node:fs/promises';
import path from 'node:path';

export type CompanionKind = 'subtitle' | 'metadata' | 'artwork';
export type MediaCompanion = { path: string; suffix: string; kind: CompanionKind };
export type AmbiguousCompanion = { path: string; candidateVideoPaths: string[] };
export type CompanionScan = { byVideo: Record<string, MediaCompanion[]>; ambiguous: AmbiguousCompanion[] };

const SUBTITLE_EXTENSIONS = new Set(['.srt', '.ass', '.ssa', '.sub', '.vtt']);
const ARTWORK_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ARTWORK_SUFFIX = /^[-.](?:poster|thumb|thumbnail|fanart|clearlogo|logo|banner)(?:[-.].*)?$/i;
const GENERIC_ARTWORK = /^(poster|thumb|thumbnail|fanart|clearlogo|logo|banner)(?:[-.].*)?\.(jpe?g|png|webp)$/i;
const SUBTITLE_DIRECTORY = /^(?:subs?|subtitles?|captions?)$/i;
const LANGUAGE_ALIASES = new Map(Object.entries({
  english: 'en', eng: 'en', en: 'en', french: 'fr', fra: 'fr', fre: 'fr', fr: 'fr',
  spanish: 'es', spa: 'es', es: 'es', german: 'de', deu: 'de', ger: 'de', de: 'de',
  italian: 'it', ita: 'it', it: 'it', portuguese: 'pt', por: 'pt', pt: 'pt',
  japanese: 'ja', jpn: 'ja', ja: 'ja', korean: 'ko', kor: 'ko', ko: 'ko',
  chinese: 'zh', zho: 'zh', chi: 'zh', zh: 'zh', dutch: 'nl', nld: 'nl', dut: 'nl', nl: 'nl',
  swedish: 'sv', swe: 'sv', sv: 'sv', norwegian: 'no', nor: 'no', no: 'no',
  danish: 'da', dan: 'da', da: 'da', finnish: 'fi', fin: 'fi', fi: 'fi',
  polish: 'pl', pol: 'pl', pl: 'pl', russian: 'ru', rus: 'ru', ru: 'ru',
  arabic: 'ar', ara: 'ar', ar: 'ar', turkish: 'tr', tur: 'tr', tr: 'tr',
  hindi: 'hi', hin: 'hi', greek: 'el', ell: 'el', gre: 'el', hebrew: 'he', heb: 'he',
}));

export function isCompanionFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return SUBTITLE_EXTENSIONS.has(extension) || extension === '.nfo' || ARTWORK_EXTENSIONS.has(extension);
}

function kindFor(filename: string, suffix: string): CompanionKind | undefined {
  const extension = path.extname(filename).toLowerCase();
  if (SUBTITLE_EXTENSIONS.has(extension) && suffix.startsWith('.')) return 'subtitle';
  if (extension === '.nfo' && /^(?:\.(?:mkv|mp4|avi|m4v|mov|webm))?\.nfo$/i.test(suffix)) return 'metadata';
  if (ARTWORK_EXTENSIONS.has(extension) && ARTWORK_SUFFIX.test(suffix)) return 'artwork';
  return undefined;
}

function normalizedEvidence(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function nestedSubtitleSuffix(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  const stem = filename.slice(0, -extension.length);
  const tokens = normalizedEvidence(stem).split(/\s+/).filter(Boolean);
  const language = tokens.map((token) => LANGUAGE_ALIASES.get(token)).find(Boolean);
  const roles: string[] = [];
  if (tokens.includes('forced')) roles.push('forced');
  if (tokens.includes('sdh') || tokens.includes('cc') || /hearing\s+impaired/i.test(stem)) roles.push('sdh');
  const qualifiers = [language, ...roles].filter(Boolean);
  return qualifiers.length ? `.${qualifiers.join('.')}${extension}` : extension;
}

function genericRootSubtitleSuffix(filename: string): string | undefined {
  const extension = path.extname(filename).toLowerCase();
  const stem = filename.slice(0, -extension.length);
  const tokens = normalizedEvidence(stem).split(/\s+/).filter(Boolean);
  const hasLanguage = tokens.some((token) => LANGUAGE_ALIASES.has(token));
  const hasRole = tokens.includes('forced') || tokens.includes('sdh') || tokens.includes('cc') || /hearing\s+impaired/i.test(stem);
  return hasLanguage || hasRole ? nestedSubtitleSuffix(filename) : undefined;
}

async function subtitleHasContent(filePath: string): Promise<boolean> {
  return (await fs.stat(filePath)).size > 0;
}

async function nestedSubtitleFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await nestedSubtitleFiles(entryPath));
    else if (entry.isFile() && SUBTITLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && await subtitleHasContent(entryPath)) result.push(entryPath);
  }
  return result;
}

function matchingVideosForNestedSubtitle(subtitlePath: string, videos: string[]): string[] {
  if (videos.length === 1) return videos;
  const evidence = normalizedEvidence(subtitlePath);
  const matched = videos.filter((videoPath) => evidence.includes(normalizedEvidence(path.basename(videoPath, path.extname(videoPath)))));
  return matched.length ? matched : videos;
}

function deduplicateSubtitleSuffixes(companions: MediaCompanion[]): void {
  const counts = new Map<string, number>();
  for (const companion of companions) {
    if (companion.kind !== 'subtitle') continue;
    const key = companion.suffix.toLocaleLowerCase();
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count === 1) continue;
    // A bare suffix such as ".srt" is treated as a dotfile by path.extname(),
    // so take the extension from the real source path instead.
    const extension = path.extname(companion.path).toLowerCase();
    companion.suffix = `${companion.suffix.slice(0, -extension.length)}.${count}${extension}`;
  }
}

export async function discoverMediaCompanions(videoPaths: string[]): Promise<CompanionScan> {
  const uniqueVideos = [...new Set(videoPaths)];
  const byVideo: Record<string, MediaCompanion[]> = Object.fromEntries(uniqueVideos.map((videoPath) => [videoPath, []]));
  const ambiguous: AmbiguousCompanion[] = [];
  const directories = new Map<string, string[]>();
  for (const videoPath of uniqueVideos) {
    const directory = path.dirname(videoPath);
    directories.set(directory, [...(directories.get(directory) ?? []), videoPath]);
  }

  await Promise.all([...directories].map(async ([directory, videos]) => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory() && SUBTITLE_DIRECTORY.test(entry.name)) {
        for (const subtitlePath of await nestedSubtitleFiles(entryPath)) {
          const candidates = matchingVideosForNestedSubtitle(subtitlePath, videos);
          if (candidates.length === 1) byVideo[candidates[0]].push({ path: subtitlePath, suffix: nestedSubtitleSuffix(path.basename(subtitlePath)), kind: 'subtitle' });
          else ambiguous.push({ path: subtitlePath, candidateVideoPaths: candidates });
        }
        continue;
      }
      if (!entry.isFile()) continue;
      const candidates = (await Promise.all(videos.map(async (videoPath) => {
        const filename = path.basename(videoPath);
        const stem = filename.slice(0, -path.extname(filename).length);
        if (!entry.name.toLocaleLowerCase().startsWith(stem.toLocaleLowerCase())) return undefined;
        const suffix = entry.name.slice(stem.length);
        const kind = kindFor(entry.name, suffix);
        if (kind === 'subtitle' && !await subtitleHasContent(entryPath)) return undefined;
        return kind ? { videoPath, suffix: kind === 'metadata' ? '.nfo' : suffix, kind } : undefined;
      }))).filter((candidate): candidate is { videoPath: string; suffix: string; kind: CompanionKind } => Boolean(candidate));
      if (candidates.length === 1) {
        const [candidate] = candidates;
        byVideo[candidate.videoPath].push({ path: entryPath, suffix: candidate.suffix, kind: candidate.kind });
      } else if (candidates.length > 1) {
        ambiguous.push({ path: entryPath, candidateVideoPaths: candidates.map((candidate) => candidate.videoPath) });
      } else if (videos.length === 1) {
        const extension = path.extname(entry.name).toLowerCase();
        const subtitleSuffix = SUBTITLE_EXTENSIONS.has(extension) ? genericRootSubtitleSuffix(entry.name) : undefined;
        if (subtitleSuffix && await subtitleHasContent(entryPath)) {
          byVideo[videos[0]].push({ path: entryPath, suffix: subtitleSuffix, kind: 'subtitle' });
        } else {
          const genericArtwork = entry.name.match(GENERIC_ARTWORK);
          if (genericArtwork) byVideo[videos[0]].push({ path: entryPath, suffix: `-${genericArtwork[1].toLowerCase()}${extension}`, kind: 'artwork' });
        }
      }
    }
  }));

  for (const companions of Object.values(byVideo)) {
    companions.sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }));
    deduplicateSubtitleSuffixes(companions);
  }
  return { byVideo, ambiguous };
}
