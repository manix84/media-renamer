export type DebugDemoMediaKind = 'shows' | 'movies';
export type DebugDemoMoveMethod = 'rename' | 'copy';
export type DebugDemoFailurePhase = 'preparing' | 'copying' | 'flushing' | 'publishing' | 'removing-source';

export interface DebugDemoItem {
  sourceName: string;
  season: number;
  episode: number;
  moveMethod: DebugDemoMoveMethod;
  sidecars: number;
  failurePhase?: DebugDemoFailurePhase;
}

export interface DebugDemoParseResult {
  items: DebugDemoItem[];
  errors: string[];
}

export const DEBUG_DEMO_SHOW_SAMPLE = `# fake filename | simulation flags
Severance.S02E01.2160p.WEB-DL.DDP5.1.H.265-DEMO.mkv | success copy sidecars=2
Severance.S02E02.2160p.WEB-DL.DDP5.1.H.265-DEMO.mkv | success copy sidecars=1
Severance.S02E03.2160p.WEB-DL.DDP5.1.H.265-DEMO.mkv | fail=publishing copy
Severance.S02E04.2160p.WEB-DL.DDP5.1.H.265-DEMO.mkv | success rename`;

export const DEBUG_DEMO_MOVIE_SAMPLE = `# fake filename | simulation flags
Blade.Runner.2049.2017.2160p.BluRay.H.265.mkv | success copy sidecars=2
The.Matrix.1999.1080p.BluRay.H.264.mkv | success rename
Arrival.2016.1080p.BluRay.H.264.mkv | fail=copying copy sidecars=1`;

const failurePhases = new Set<DebugDemoFailurePhase>(['preparing', 'copying', 'flushing', 'publishing', 'removing-source']);

export function parseDebugDemo(text: string, mediaKind: DebugDemoMediaKind): DebugDemoParseResult {
  const items: DebugDemoItem[] = [];
  const errors: string[] = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('|').map((part) => part.trim());
    if (!parts[0] || parts.length > 2) {
      errors.push(`Line ${index + 1}: expected fake filename | simulation flags`);
      continue;
    }
    const flags = (parts[1] ?? '').split(/[\s,]+/).filter(Boolean);
    let moveMethod: DebugDemoMoveMethod = 'copy';
    let sidecars = 0;
    let failurePhase: DebugDemoFailurePhase | undefined;
    let genericFailure = false;
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
      season: episodeCode ? Number(episodeCode[1]) : 0,
      episode: episodeCode ? Number(episodeCode[2]) : items.length + 1,
      moveMethod,
      sidecars,
      failurePhase,
    });
  }
  if (!items.length && !errors.length) errors.push('Add at least one demo row.');
  return { items, errors };
}
