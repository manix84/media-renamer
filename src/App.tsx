import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertCircle, Check, ChevronRight, FileVideo, Film, FolderOpen, FolderPlus, LoaderCircle, Search, Sparkles, SquareTerminal, Tv, X } from 'lucide-react';
import { formatEpisode } from './core/formatter';
import { formatSeasonLabel } from './core/seasonLabel';
import { inferShowQuery } from './core/showInference';
import type { Episode, FileMatch, ProviderStatus, ShowDetails, ShowSearchResult } from './core/types';
import { DebugPanel, type DebugEntry, type DockPosition } from './DebugConsole';

type WorkProgress = { operation: 'Scanning' | 'Importing' | 'Renaming'; completed: number; total: number };
type DebugLevel = 'info' | 'success' | 'warning' | 'error';

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

function filenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export default function App() {
  const [paths, setPaths] = useState<string[]>([]);
  const [titleMatching, setTitleMatching] = useState(true);
  const [provider, setProvider] = useState<ProviderStatus>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ShowSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [show, setShow] = useState<ShowDetails>();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [work, setWork] = useState<WorkProgress>();
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [error, setError] = useState<string>();
  const [debugDocked, setDebugDocked] = useState(true);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [dockPosition, setDockPosition] = useState<DockPosition>('bottom');
  const [dockSizes, setDockSizes] = useState({ left: 420, right: 420, bottom: 270 });
  const searchSequence = useRef(0);
  const seasonSequence = useRef(0);
  const autoSelectResult = useRef(false);

  const addDebug = useCallback((level: DebugLevel, message: string, detail?: string) => {
    window.mediaRenamer?.appendDebug({ level, message, detail });
  }, []);

  const confident = matches.filter((item) => item.status === 'confident').length;
  const matchesByPath = new Map(matches.map((item) => [item.path, item]));

  useEffect(() => {
    window.mediaRenamer?.providerStatus().then((status) => {
      setProvider(status);
      addDebug(status.configured ? 'success' : 'warning', status.configured ? 'TMDB provider configured' : 'TMDB provider is not configured');
    }).catch((reason) => {
      const message = errorMessage(reason);
      setError(message);
      addDebug('error', 'Could not read provider status', message);
    });
  }, [addDebug]);

  useEffect(() => {
    let active = true;
    window.mediaRenamer?.getDebugEntries().then((initial) => { if (active) setDebugEntries(initial); });
    const unsubscribeEntries = window.mediaRenamer?.onDebugEntries(setDebugEntries);
    const unsubscribeDock = window.mediaRenamer?.onDebugDock(() => setDebugDocked(true));
    return () => { active = false; unsubscribeEntries?.(); unsubscribeDock?.(); };
  }, []);

  useEffect(() => {
    if (!provider?.configured || show || query.trim() || paths.length === 0) return;
    const inferred = inferShowQuery(paths);
    if (!inferred) {
      addDebug('warning', 'Could not infer a show name', 'No common SxxExx or 1x02 filename pattern was found.');
      return;
    }
    addDebug('info', `Inferred show query: ${inferred}`, `Derived from ${paths.length} imported file${paths.length === 1 ? '' : 's'}.`);
    autoSelectResult.current = true;
    setQuery(inferred);
  }, [addDebug, paths, provider?.configured, query, show]);

  useEffect(() => {
    if (paths.length === 0 || episodes.length === 0) {
      setMatches([]);
      setWork(undefined);
      return;
    }

    const worker = new Worker(new URL('./workers/matchWorker.ts', import.meta.url), { type: 'module' });
    setWork({ operation: 'Importing', completed: 0, total: paths.length });
    addDebug('info', `Matching ${paths.length} file${paths.length === 1 ? '' : 's'}`, `Comparing against ${episodes.length} episodes in a background worker.`);
    worker.onmessage = (event: MessageEvent<{ type: 'progress'; completed: number; total: number } | { type: 'complete'; matches: FileMatch[] }>) => {
      if (event.data.type === 'progress') {
        setWork({ operation: 'Importing', completed: event.data.completed, total: event.data.total });
      } else {
        setMatches(event.data.matches);
        for (const item of event.data.matches) {
          const score = Math.round((item.match?.score ?? 0) * 100);
          const episode = item.match?.episode;
          const target = episode ? `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')} ${episode.title}` : 'no episode';
          const evidence = item.match?.reasons.length ? item.match.reasons.join('; ') : 'no sufficiently strong matching evidence';
          if (item.status === 'confident') addDebug('success', `Accepted ${item.filename} → ${target}`, `${score}% confidence: ${evidence}.`);
          else if (item.status === 'review') addDebug('warning', `Review ${item.filename} → ${target}`, `${score}% confidence: ${evidence}. Manual confirmation is required.`);
          else addDebug('error', `Rejected ${item.filename}`, `${score}% confidence: ${evidence}.`);
        }
        setWork(undefined);
        worker.terminate();
      }
    };
    worker.onerror = () => {
      setError('The file matching worker stopped unexpectedly.');
      addDebug('error', 'File matching worker stopped unexpectedly');
      setWork(undefined);
      worker.terminate();
    };
    worker.postMessage({ paths, episodes, titleMatching });
    return () => worker.terminate();
  }, [addDebug, paths, episodes, titleMatching]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!provider?.configured || trimmed.length < 2 || (show && trimmed === show.name)) {
      setResults([]);
      setSearching(false);
      return;
    }
    const sequence = ++searchSequence.current;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError(undefined);
      addDebug('info', `Searching for “${trimmed}”`);
      try {
        const found = await window.mediaRenamer?.searchShows(trimmed) ?? [];
        if (searchSequence.current === sequence) {
          addDebug(found.length ? 'success' : 'warning', `Search returned ${found.length} result${found.length === 1 ? '' : 's'}`, found.length ? found.slice(0, 5).map((item) => `${item.name}${item.year ? ` (${item.year})` : ''}`).join(', ') : `No provider result matched “${trimmed}”.`);
          if (autoSelectResult.current && found[0]) {
            autoSelectResult.current = false;
            addDebug('info', `Automatically selecting ${found[0].name}`, 'Using the first result for the show name inferred from the imported files.');
            void selectShow(found[0]);
          } else {
            setResults(found);
          }
        }
      } catch (reason) {
        if (searchSequence.current === sequence) {
          const message = errorMessage(reason);
          setError(message);
          addDebug('error', `Search failed for “${trimmed}”`, message);
        }
      } finally {
        if (searchSequence.current === sequence) setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [addDebug, provider?.configured, query, show]);

  async function selectShow(result: ShowSearchResult) {
    const sequence = ++seasonSequence.current;
    setQuery(result.name);
    autoSelectResult.current = false;
    setResults([]);
    setError(undefined);
    setLoadingEpisodes(true);
    addDebug('info', `Loading ${result.name}`, `Provider ID ${result.id}. Fetching every available season.`);
    try {
      const details = await window.mediaRenamer?.getShow(result.id);
      if (!details) {
        addDebug('error', `Could not load ${result.name}`, 'The metadata provider returned no show details.');
        return;
      }
      setShow(details);
      const seasons = await Promise.all(details.seasons.map((item) => window.mediaRenamer?.getSeasonEpisodes(details.id, item.number) ?? []));
      if (seasonSequence.current === sequence) {
        const loadedEpisodes = seasons.flat().sort((left, right) => left.season - right.season || left.number - right.number);
        setEpisodes(loadedEpisodes);
        addDebug('success', `Loaded ${details.name}`, `${loadedEpisodes.length} episodes across ${details.seasons.length} seasons.`);
      }
    } catch (reason) {
      if (seasonSequence.current === sequence) {
        const message = errorMessage(reason);
        setError(message);
        setShow(undefined);
        setEpisodes([]);
        addDebug('error', `Could not load ${result.name}`, message);
      }
    } finally {
      if (seasonSequence.current === sequence) setLoadingEpisodes(false);
    }
  }

  async function addFiles() {
    try {
      const selected = await window.mediaRenamer?.pickFiles();
      if (selected?.length) {
        setPaths((current) => [...new Set([...current, ...selected])]);
        addDebug('success', `Added ${selected.length} file${selected.length === 1 ? '' : 's'}`, 'Supported video files were queued for matching.');
      } else addDebug('info', 'File selection cancelled');
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      addDebug('error', 'Could not add files', message);
    }
  }

  async function addFolders() {
    setWork({ operation: 'Scanning', completed: 0, total: 0 });
    setError(undefined);
    addDebug('info', 'Waiting for folder selection');
    try {
      const selected = await window.mediaRenamer?.pickFolders();
      if (selected?.length) {
        setPaths((current) => [...new Set([...current, ...selected])]);
        addDebug('success', `Folder scan found ${selected.length} video file${selected.length === 1 ? '' : 's'}`, 'Subdirectories were included; unsupported files and symbolic links were ignored.');
      } else {
        setWork(undefined);
        addDebug('info', 'Folder selection cancelled or contained no supported videos');
      }
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      setWork(undefined);
      addDebug('error', 'Folder scan failed', message);
    }
  }

  async function addDroppedItems(files: FileList) {
    const dropped = [...files].map((file) => window.mediaRenamer?.pathForFile(file)).filter((value): value is string => Boolean(value));
    if (!dropped.length) {
      addDebug('warning', 'Dropped items could not be read', 'Electron did not expose filesystem paths for these items.');
      return;
    }
    setWork({ operation: 'Scanning', completed: 0, total: 0 });
    setError(undefined);
    addDebug('info', `Scanning ${dropped.length} dropped item${dropped.length === 1 ? '' : 's'}`, 'Folders will be searched recursively.');
    try {
      const expanded = await window.mediaRenamer?.expandPaths(dropped) ?? [];
      if (expanded.length) {
        setPaths((current) => [...new Set([...current, ...expanded])]);
        addDebug('success', `Drop scan found ${expanded.length} video file${expanded.length === 1 ? '' : 's'}`, 'Unsupported files and symbolic links were ignored.');
      } else {
        setWork(undefined);
        addDebug('warning', 'No supported video files found in dropped items');
      }
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      setWork(undefined);
      addDebug('error', 'Drop scan failed', message);
    }
  }

  function seasonHeading(number: number): string {
    const season = show?.seasons.find((item) => item.number === number);
    return formatSeasonLabel(season?.name, number);
  }

  function beginDockResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = dockSizes[dockPosition];
    const move = (moveEvent: PointerEvent) => {
      const rawSize = dockPosition === 'bottom'
        ? startSize + startY - moveEvent.clientY
        : dockPosition === 'left'
          ? startSize + moveEvent.clientX - startX
          : startSize + startX - moveEvent.clientX;
      const maximum = dockPosition === 'bottom' ? window.innerHeight - 300 : window.innerWidth - 560;
      setDockSizes((current) => ({ ...current, [dockPosition]: Math.max(170, Math.min(maximum, rawSize)) }));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
  }

  return (
    <div className={`app-shell platform-${window.mediaRenamer?.platform ?? 'web'} ${debugDocked ? `debug-docked dock-${dockPosition}` : ''}`} style={{ '--debug-size': `${dockSizes[dockPosition]}px` } as CSSProperties}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Tv size={18} /></span> Media Renamer <span className="beta">ALPHA</span></div>
        <nav><button className="nav-active"><Tv size={15}/> TV</button><button disabled><Film size={15}/> Movies <span className="soon">soon</span></button></nav>
        <button className={`icon-button ${debugDocked ? 'active' : ''}`} aria-label="Toggle docked debug console" title="Toggle debug console" onClick={() => { if (debugDocked) setDebugDocked(false); else { setDebugDocked(true); void window.mediaRenamer?.dockDebugConsole(); } }}><SquareTerminal size={18}/></button>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">ACTIVE SHOW</p>
            <h1>{show ? <>{show.name} {show.year && <span>({show.year})</span>}</> : 'Choose a TV show'}</h1>
            <p>{show ? `${episodes.length} episodes · ${show.seasons.length} seasons · TMDB` : 'Search TMDB to load real episode metadata'}</p>
          </div>
          <div className="show-search">
            <label className="search"><Search size={17}/><input value={query} onChange={(event) => { autoSelectResult.current = false; setQuery(event.target.value); if (event.target.value !== show?.name) { seasonSequence.current += 1; setShow(undefined); setEpisodes([]); setLoadingEpisodes(false); } }} placeholder="Show name, tvdb-482771, or tmdb-…" autoComplete="off"/>{searching ? <LoaderCircle className="spin" size={16}/> : <kbd>⌘ K</kbd>}</label>
            {results.length > 0 && <div className="search-results">
              {results.map((result) => <button key={result.id} onClick={() => void selectShow(result)}>
                {result.posterUrl ? <img src={result.posterUrl} alt=""/> : <span className="poster-placeholder"><Tv size={18}/></span>}
                <span><strong>{result.name}</strong><small>{result.year ?? 'Year unknown'}</small></span>
              </button>)}
            </div>}
          </div>
        </section>

        {!provider?.configured && provider && <div className="notice"><AlertCircle size={17}/><span><strong>TMDB access token needed.</strong> Add <code>TMDB_ACCESS_TOKEN=…</code> to <code>.env</code>, then restart the app.</span></div>}
        {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}

        <section className="workflow">
          <aside className="episode-panel panel">
            <div className="panel-heading">
              <div><p className="eyebrow">EPISODES</p><h2>{show ? `${show.seasons.length} seasons` : 'Select a show'}</h2></div>
              {show && <span className="count">{episodes.length}</span>}
            </div>
            <div className="episode-list">
              {loadingEpisodes && <div className="empty-state"><LoaderCircle className="spin" size={20}/>Loading episodes…</div>}
              {!loadingEpisodes && episodes.map((episode, index) => <div key={episode.id}>
                {episodes[index - 1]?.season !== episode.season && <div className="season-divider">{seasonHeading(episode.season)}</div>}
                <div className="episode"><span>{String(episode.number).padStart(2, '0')}</span><strong>{episode.title}</strong><Check size={14}/></div>
              </div>)}
              {!loadingEpisodes && episodes.length === 0 && <div className="empty-state">Search for a show to begin.</div>}
            </div>
          </aside>

          <section className="match-panel panel">
            <div className="panel-heading main-heading">
              <div><p className="eyebrow">MATCH &amp; REVIEW</p><h2>{paths.length} imported files</h2></div>
              <div className="add-actions"><button className="secondary" onClick={addFiles}><FolderOpen size={16}/> Add files</button><button className="secondary" onClick={addFolders}><FolderPlus size={16}/> Add folder</button></div>
            </div>
            <label className="matching-option"><span><Sparkles size={17}/><span><strong>Match episode names</strong><small>Best effort when numbering and titles disagree</small></span></span><input type="checkbox" checked={titleMatching} onChange={(event) => { setTitleMatching(event.target.checked); addDebug('info', `Episode-title matching ${event.target.checked ? 'enabled' : 'disabled'}`); }}/></label>
            {work && <div className="work-status" role="status" aria-live="polite">
              <LoaderCircle className="spin" size={18}/>
              <span><strong>{work.operation === 'Scanning' ? 'Scanning folders' : `${work.operation} files`}</strong><small>{work.total ? `${work.total - work.completed} of ${work.total} remaining` : 'Discovering video files…'}</small></span>
              {work.total > 0 && <progress value={work.completed} max={work.total}/>}
            </div>}
            <div className="match-list">
              {paths.map((path) => {
                const item = matchesByPath.get(path);
                const filename = item?.filename ?? filenameFromPath(path);
                const output = item?.match && show ? formatEpisode(show.name, show.year, item.match.episode, item.tags) : 'No suggested name';
                const extension = filename.match(/(\.[^.]+)$/)?.[1] ?? '';
                const status = item?.status ?? 'pending';
                return <article className="match-row" key={path}>
                  <div className={`status-dot ${status}`}>{status === 'confident' ? <Check/> : status === 'review' ? '!' : status === 'unmatched' ? <X/> : '…'}</div>
                  <div className="file-pair"><div className="original"><FileVideo size={15}/><span>{filename}</span></div><div className="arrow"><ChevronRight size={15}/></div><div className="proposed">{item ? output : 'Waiting for show metadata'}<span>{item?.match ? extension : ''}</span></div></div>
                  <div className="score"><strong>{item ? `${Math.round((item.match?.score ?? 0) * 100)}%` : '—'}</strong><small>{status}</small></div>
                </article>;
              })}
            </div>
            <button className="dropzone" onClick={addFiles} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addDroppedItems(event.dataTransfer.files); }}><FolderOpen size={24}/><span>Drop files or folders here</span><small>or click to choose video files</small></button>
          </section>
        </section>
      </main>

      <footer><div><span className="legend confident"></span>{confident} ready <span className="legend review"></span>{paths.length - confident} need review <span className="tmdb-attribution">This product uses the TMDB API but is not endorsed or certified by TMDB.</span></div><div><button className="secondary" disabled>Export plan</button><button className="primary" disabled>Rename {confident} files <ChevronRight size={16}/></button></div></footer>

      {debugDocked && (
        <DebugPanel entries={debugEntries} mode="docked" dockPosition={dockPosition} onDockPositionChange={setDockPosition} onResizeStart={beginDockResize} onClear={() => void window.mediaRenamer?.clearDebugEntries()} onPopout={() => {
          setDebugDocked(false);
          void window.mediaRenamer?.openDebugConsole();
        }}/>
      )}
    </div>
  );
}
