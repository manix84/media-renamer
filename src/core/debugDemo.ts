export type DebugDemoMediaKind = 'shows' | 'movies';
export type DebugDemoMoveMethod = 'rename' | 'copy';
export type DebugDemoFailurePhase = 'preparing' | 'copying' | 'flushing' | 'publishing' | 'removing-source';

export interface DebugDemoItem {
  sourceName: string;
  title: string;
  season: number;
  episode: number;
  year?: number;
  moveMethod: DebugDemoMoveMethod;
  sidecars: number;
  failurePhase?: DebugDemoFailurePhase;
}

export interface DebugDemoParseResult {
  items: DebugDemoItem[];
  errors: string[];
}

export const DEBUG_DEMO_SHOW_SAMPLE = `# source filename | episode title | flags
Demo.Show.S01E01.1080p.WEB-DL.mkv | A Promising Beginning | success copy sidecars=2
Demo.Show.S01E02.1080p.WEB-DL.mkv | The Slow Destination | success copy sidecars=1
Demo.Show.S01E03.1080p.WEB-DL.mkv | Something Goes Wrong | fail=publishing copy
Demo.Show.S01E04.1080p.WEB-DL.mkv | Back on Track | success rename`;

export const DEBUG_DEMO_MOVIE_SAMPLE = `# source filename | movie title | flags
The.Demo.Movie.2024.1080p.WEB-DL.mkv | The Demo Movie | success copy sidecars=2 year=2024
An.Atomic.Example.1999.BluRay.mkv | An Atomic Example | success rename year=1999
The.Unlucky.Move.2021.1080p.mkv | The Unlucky Move | fail=copying copy sidecars=1 year=2021`;

const failurePhases = new Set<DebugDemoFailurePhase>(['preparing', 'copying', 'flushing', 'publishing', 'removing-source']);

export function parseDebugDemo(text: string, mediaKind: DebugDemoMediaKind): DebugDemoParseResult {
  const items: DebugDemoItem[] = [];
  const errors: string[] = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('|').map((part) => part.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      errors.push(`Line ${index + 1}: expected source filename | title | flags`);
      continue;
    }
    const flags = (parts[2] ?? '').split(/[\s,]+/).filter(Boolean);
    let moveMethod: DebugDemoMoveMethod = 'copy';
    let sidecars = 0;
    let failurePhase: DebugDemoFailurePhase | undefined;
    let genericFailure = false;
    let year: number | undefined;
    for (const flag of flags) {
      if (flag === 'success') continue;
      if (flag === 'copy' || flag === 'rename') { moveMethod = flag; continue; }
      if (flag === 'fail') { genericFailure = true; continue; }
      if (flag.startsWith('fail=')) {
        const phase = flag.slice(5) as DebugDemoFailurePhase;
        if (failurePhases.has(phase)) failurePhase = phase;
        else errors.push(`Line ${index + 1}: unknown failure phase “${flag.slice(5)}”`);
        continue;
      }
      if (flag.startsWith('sidecars=')) {
        const count = Number(flag.slice(9));
        if (Number.isInteger(count) && count >= 0 && count <= 20) sidecars = count;
        else errors.push(`Line ${index + 1}: sidecars must be between 0 and 20`);
        continue;
      }
      if (flag.startsWith('year=')) {
        const parsedYear = Number(flag.slice(5));
        if (Number.isInteger(parsedYear) && parsedYear >= 1870 && parsedYear <= 2200) year = parsedYear;
        else errors.push(`Line ${index + 1}: year must be between 1870 and 2200`);
        continue;
      }
      errors.push(`Line ${index + 1}: unknown flag “${flag}”`);
    }
    if (genericFailure && !failurePhase) failurePhase = moveMethod === 'copy' ? 'copying' : 'preparing';
    const episodeCode = parts[0].match(/S(\d{1,3})E(\d{1,4})/i);
    if (mediaKind === 'shows' && !episodeCode) {
      errors.push(`Line ${index + 1}: TV filenames need an SxxExx episode code`);
      continue;
    }
    items.push({
      sourceName: parts[0],
      title: parts[1],
      season: episodeCode ? Number(episodeCode[1]) : 0,
      episode: episodeCode ? Number(episodeCode[2]) : items.length + 1,
      year,
      moveMethod,
      sidecars,
      failurePhase,
    });
  }
  if (!items.length && !errors.length) errors.push('Add at least one demo row.');
  return { items, errors };
}
