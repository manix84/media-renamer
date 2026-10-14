import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type UIEvent } from 'react';
import { AlertCircle, Captions, Check, ChevronRight, FileCheck2, FileImage, FileText, FileVideo, Film, FolderOpen, FolderPlus, FolderTree, ListChecks, LoaderCircle, Monitor, Moon, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, SquareTerminal, Sun, Trash2, TriangleAlert, Tv, X } from 'lucide-react';
import { DEFAULT_EPISODE_TEMPLATE, DEFAULT_MOVIE_FOLDER_TEMPLATE, DEFAULT_SHOW_FOLDER_TEMPLATE, formatEpisode, formatEpisodeFilename, formatMovieFolder, formatShowFolder, movieFolderTemplateError, PREVIOUS_DEFAULT_EPISODE_TEMPLATE, PREVIOUS_TVDB_DEFAULT_EPISODE_TEMPLATE, showFolderTemplateError, templateError } from './core/formatter';
import { createRenamePlan } from './core/renamePlan';
import { applyReleaseOverrides } from './core/releaseTags';
import { formatSeasonLabel } from './core/seasonLabel';
import { inferShowQuery } from './core/showInference';
import type { CompanionScan, Episode, FileMatch, MatchCandidate, MediaTechnicalTags, ProviderStatus, RenamePlanIssue, ShowDetails, ShowSearchResult, Source } from './core/types';
import { DebugPanel, type DebugEntry, type DockPosition } from './DebugConsole';
import { useTheme } from './theme';

type WorkProgress = { operation: 'Scanning' | 'Importing' | 'Renaming'; completed: number; total: number };
type DebugLevel = 'info' | 'success' | 'warning' | 'error';
type TemplateField = { name: string; description: string; example: string };
type FileViewMode = 'detailed' | 'summary' | 'compact';

const TEMPLATE_FIELDS: Array<{ label: string; fields: TemplateField[] }> = [
  { label: 'Show', fields: [
    { name: 'show.name', description: 'Series title', example: 'Show Name' },
    { name: 'show.year', description: 'Premiere year, when known', example: '2026' },
    { name: 'show.tvdbId', description: 'Canonical TVDB series ID', example: '74550' },
  ] },
  { label: 'Episode', fields: [
    { name: 'episode.range', description: 'Combined season and episode range', example: 'S01E01-E02' },
    { name: 'episodes', description: 'Repeating section for merged episodes', example: '2 items' },
    { name: 'title', description: 'Title inside an episodes section', example: 'Episode 1' },
    { name: 'code', description: 'Episode code inside an episodes section', example: 'S01E01' },
    { name: 'season', description: 'Unpadded season number', example: '1' },
    { name: 'seasonPadded', description: 'Two-digit season number', example: '01' },
    { name: 'number', description: 'Unpadded episode number', example: '1' },
    { name: 'numberPadded', description: 'Two-digit episode number', example: '01' },
    { name: 'first', description: 'True for the first repeated episode', example: 'true' },
    { name: 'last', description: 'True for the last repeated episode', example: 'false' },
  ] },
  { label: 'Release', fields: [
    { name: 'technical', description: 'Detected video/audio details plus release tags', example: '1080p WEB-DL H.264 AAC 2.0' },
    { name: 'release.resolution', description: 'Video resolution', example: '1080p' },
    { name: 'release.source', description: 'Release source', example: 'WEB-DL' },
    { name: 'release.videoCodec', description: 'Video codec', example: 'H.264' },
    { name: 'release.audioCodec', description: 'Audio codec', example: 'AAC' },
    { name: 'release.channels', description: 'Audio channel layout', example: '2.0' },
    { name: 'release.group', description: 'Release group', example: 'GROUP' },
    { name: 'release.flags', description: 'Detected flags', example: 'AI Upscale' },
  ] },
];

const SOURCE_OPTIONS: Source[] = ['DVD', 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'DVDRip', 'TVRip'];

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

function filenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function episodeCode(episode: Episode): string {
  return `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`;
}

function joinPath(directory: string, relativePath: string): string {
  if (!relativePath) return directory.replace(/[\\/]+$/, '');
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return `${directory.replace(/[\\/]+$/, '')}${separator}${relativePath.replace(/[\\/]+/g, separator)}`;
}

function highlightedTemplate(template: string): ReactNode[] {
  return template.split(/({{[^{}]*}})/g).filter(Boolean).map((part, index) => {
    if (!part.startsWith('{{')) return <span key={index}>{part}</span>;
    const marker = part.match(/^{{\s*([#\/^])/)?.[1];
    return <span className={marker ? 'template-section' : 'template-variable'} key={index}>{part}</span>;
  });
}

function TemplateEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const highlight = useRef<HTMLPreElement>(null);
  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (!highlight.current) return;
    highlight.current.scrollTop = event.currentTarget.scrollTop;
    highlight.current.scrollLeft = event.currentTarget.scrollLeft;
  };
  return <div className="template-editor">
    <pre ref={highlight} aria-hidden="true">{highlightedTemplate(value)}{'\n'}</pre>
    <textarea aria-label="Episode filename template" value={value} onChange={(event) => onChange(event.target.value)} onScroll={syncScroll} spellCheck={false}/>
  </div>;
}

export default function App() {
  const { preference, setPreference } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [titleMatching, setTitleMatching] = useState(true);
  const [sourceOverride, setSourceOverride] = useState<Source | 'auto'>('auto');
  const [aiUpscaleOverride, setAiUpscaleOverride] = useState<'auto' | 'on' | 'off'>('auto');
  const [moveFiles, setMoveFiles] = useState(true);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [batchMetadataOpen, setBatchMetadataOpen] = useState(false);
  const [refreshConfirmation, setRefreshConfirmation] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState(false);
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>(() => {
    const saved = localStorage.getItem('media-renamer-file-view-mode');
    return saved === 'detailed' || saved === 'compact' ? saved : 'summary';
  });
  const [tvBaseFolder, setTvBaseFolder] = useState(() => localStorage.getItem('media-renamer-tv-base-folder') ?? '');
  const [showFolderTemplate, setShowFolderTemplate] = useState(() => localStorage.getItem('media-renamer-show-folder-template') ?? DEFAULT_SHOW_FOLDER_TEMPLATE);
  const [movieBaseFolder, setMovieBaseFolder] = useState(() => localStorage.getItem('media-renamer-movie-base-folder') ?? '');
  const [movieFolderTemplate, setMovieFolderTemplate] = useState(() => localStorage.getItem('media-renamer-movie-folder-template') ?? DEFAULT_MOVIE_FOLDER_TEMPLATE);
  const [episodeTemplate, setEpisodeTemplate] = useState(() => {
    const saved = localStorage.getItem('media-renamer-episode-template');
    return !saved || saved === PREVIOUS_DEFAULT_EPISODE_TEMPLATE || saved === PREVIOUS_TVDB_DEFAULT_EPISODE_TEMPLATE ? DEFAULT_EPISODE_TEMPLATE : saved;
  });
  const [provider, setProvider] = useState<ProviderStatus>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ShowSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [show, setShow] = useState<ShowDetails>();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [matchOverrides, setMatchOverrides] = useState<Record<string, MatchCandidate>>({});
  const [confirmedPaths, setConfirmedPaths] = useState<Set<string>>(() => new Set());
  const [reviewingPath, setReviewingPath] = useState<string>();
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewCandidate, setReviewCandidate] = useState<MatchCandidate>();
  const [pinnedPreviewPath, setPinnedPreviewPath] = useState<string>();
  const [fileDropActive, setFileDropActive] = useState(false);
  const [technicalTags, setTechnicalTags] = useState<Record<string, MediaTechnicalTags>>({});
  const [companionScan, setCompanionScan] = useState<CompanionScan>({ byVideo: {}, ambiguous: [] });
  const [probeStates, setProbeStates] = useState<Record<string, 'loading' | 'complete' | 'error'>>({});
  const [work, setWork] = useState<WorkProgress>();
  const [filesystemIssues, setFilesystemIssues] = useState<RenamePlanIssue[]>([]);
  const [checkingPlan, setCheckingPlan] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [error, setError] = useState<string>();
  const [debugDocked, setDebugDocked] = useState(true);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [dockPosition, setDockPosition] = useState<DockPosition>('bottom');
  const [dockSizes, setDockSizes] = useState({ left: 420, right: 420, bottom: 270 });
  const searchSequence = useRef(0);
  const seasonSequence = useRef(0);
  const autoSelectResult = useRef(false);
  const probedPaths = useRef(new Set<string>());
  const probeRuns = useRef<Record<string, number>>({});
  const fileDropDepth = useRef(0);

  const enterFileDropTarget = (event: ReactDragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    fileDropDepth.current += 1;
    setFileDropActive(true);
  };

  const leaveFileDropTarget = (event: ReactDragEvent<HTMLElement>) => {
    fileDropDepth.current = Math.max(0, fileDropDepth.current - 1);
    if (fileDropDepth.current === 0) setFileDropActive(false);
  };

  const dropFilesOnPanel = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    fileDropDepth.current = 0;
    setFileDropActive(false);
    if (event.dataTransfer.files.length) void addDroppedItems(event.dataTransfer.files);
  };

  const addDebug = useCallback((level: DebugLevel, message: string, detail?: string) => {
    window.mediaRenamer?.appendDebug({ level, message, detail });
  }, []);

  const inspectMedia = useCallback(async (targets: string[]) => {
    if (!window.mediaRenamer?.probeMedia || !targets.length) return;
    const jobs = targets.map((path) => {
      probedPaths.current.add(path);
      const run = (probeRuns.current[path] ?? 0) + 1;
      probeRuns.current[path] = run;
      return { path, run };
    });
    setProbeStates((current) => ({ ...current, ...Object.fromEntries(targets.map((path) => [path, 'loading' as const])) }));
    addDebug('info', `Inspecting ${targets.length} media file${targets.length === 1 ? '' : 's'}`, 'Reading embedded video and audio stream metadata with ffprobe.');
    let cursor = 0;

    const inspectNext = async () => {
      while (true) {
        const job = jobs[cursor++];
        if (!job) return;
        const filename = filenameFromPath(job.path);
        try {
          const detected = await window.mediaRenamer!.probeMedia(job.path);
          if (probeRuns.current[job.path] !== job.run) continue;
          setTechnicalTags((current) => ({ ...current, [job.path]: detected }));
          setProbeStates((current) => ({ ...current, [job.path]: 'complete' }));
          const summary = [detected.resolution, detected.videoCodec, detected.audioCodec, detected.channels].filter(Boolean).join(' · ');
          addDebug('success', `Inspected ${filename}`, summary || 'No video or audio streams were detected.');
        } catch (reason) {
          if (probeRuns.current[job.path] !== job.run) continue;
          const message = errorMessage(reason);
          setProbeStates((current) => ({ ...current, [job.path]: 'error' }));
          addDebug('warning', `Could not inspect ${filename}`, `${message} Filename-derived release tags will be used.`);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, () => inspectNext()));
  }, [addDebug]);

  const automaticMatchesByPath = useMemo(() => new Map(matches.map((item) => [item.path, item])), [matches]);
  const matchesByPath = useMemo(() => new Map(matches.map((item) => [item.path, matchOverrides[item.path] ? { ...item, match: matchOverrides[item.path] } : item])), [matchOverrides, matches]);
  const reviewingItem = reviewingPath ? matchesByPath.get(reviewingPath) : undefined;
  const reviewingAutomaticItem = reviewingPath ? automaticMatchesByPath.get(reviewingPath) : undefined;
  const suggestedCandidates = useMemo(() => {
    if (!reviewingItem) return [];
    const candidates = [reviewingItem.match, reviewingAutomaticItem?.match, ...reviewingItem.alternatives].filter((candidate): candidate is MatchCandidate => Boolean(candidate));
    return [...new Map(candidates.map((candidate) => [candidate.episode.id, candidate])).values()];
  }, [reviewingAutomaticItem, reviewingItem]);
  const reviewCandidates = useMemo(() => {
    const search = reviewSearch.trim().toLocaleLowerCase();
    if (!search) return suggestedCandidates;
    return episodes.filter((episode) => `${episodeCode(episode)} ${episode.title}`.toLocaleLowerCase().includes(search)).slice(0, 100).map((episode) => suggestedCandidates.find((candidate) => candidate.episode.id === episode.id) ?? { episode, score: 1, reasons: ['manually selected'] });
  }, [episodes, reviewSearch, suggestedCandidates]);
  const formatError = templateError(episodeTemplate);
  const folderFormatError = showFolderTemplateError(showFolderTemplate);
  const movieFolderFormatError = movieFolderTemplateError(movieFolderTemplate);
  const showFolder = show && !folderFormatError ? formatShowFolder(showFolderTemplate, show.name, show.year, show.tvdbId) : undefined;
  const destinationDirectory = moveFiles && tvBaseFolder && showFolder !== undefined ? joinPath(tvBaseFolder, showFolder) : undefined;
  const exampleTags = applyReleaseOverrides({ source: 'WEB-DL', resolution: '1080p', videoCodec: 'H.264', audioCodec: 'AAC', channels: '2.0', flags: [] }, {
    source: sourceOverride === 'auto' ? undefined : sourceOverride,
    aiUpscale: aiUpscaleOverride === 'auto' ? undefined : aiUpscaleOverride === 'on',
  });
  const formatExample = formatError ? undefined : formatEpisode(episodeTemplate, 'Show Name', 2026, [
    { id: 'example-1', season: 1, number: 1, title: 'Episode 1' },
    { id: 'example-2', season: 1, number: 2, title: 'Episode 2' },
  ], exampleTags, '74550');
  const inspectingAny = paths.some((path) => probeStates[path] === 'loading');
  const ambiguousCompanionsByVideo = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const ambiguous of companionScan.ambiguous) for (const path of ambiguous.candidateVideoPaths) result.set(path, [...(result.get(path) ?? []), ambiguous.path]);
    return result;
  }, [companionScan.ambiguous]);
  const renamePlan = useMemo(() => createRenamePlan(paths.map((path) => {
    const item = matchesByPath.get(path);
    const tags = item ? applyReleaseOverrides({ ...item.tags, ...technicalTags[path] }, {
      source: sourceOverride === 'auto' ? undefined : sourceOverride,
      aiUpscale: aiUpscaleOverride === 'auto' ? undefined : aiUpscaleOverride === 'on',
    }) : undefined;
    const extension = filenameFromPath(path).match(/(\.[^.]+)$/)?.[1] ?? '';
    const companions = companionScan.byVideo[path] ?? [];
    const encoder = new TextEncoder();
    const extensionBytes = encoder.encode(extension).length;
    const longestCompanionSuffix = companions.reduce((longest, companion) => Math.max(longest, encoder.encode(companion.suffix).length), 0);
    const videoFilenameBudget = 255 - Math.max(0, longestCompanionSuffix - extensionBytes);
    const targetName = item?.match && show && tags && !formatError ? formatEpisodeFilename(episodeTemplate, show.name, show.year, item.match.episode, tags, extension, show.tvdbId, videoFilenameBudget) : undefined;
    return {
      sourcePath: path,
      targetName,
      targetDirectory: destinationDirectory,
      configurationError: moveFiles && tvBaseFolder && folderFormatError ? `Fix the show folder pattern: ${folderFormatError}` : undefined,
      companionError: ambiguousCompanionsByVideo.get(path)?.length ? `${ambiguousCompanionsByVideo.get(path)!.length} companion file${ambiguousCompanionsByVideo.get(path)!.length === 1 ? '' : 's'} could belong to more than one imported video.` : undefined,
      companions,
      matchStatus: confirmedPaths.has(path) ? 'confident' : item?.status ?? 'pending',
      confidence: item?.match?.score ?? 0,
    };
  })), [aiUpscaleOverride, ambiguousCompanionsByVideo, companionScan.byVideo, confirmedPaths, destinationDirectory, episodeTemplate, folderFormatError, formatError, matchesByPath, moveFiles, paths, show, sourceOverride, technicalTags, tvBaseFolder]);
  const preflightPlan = useMemo(() => {
    const filesystemBySource = new Map<string, RenamePlanIssue[]>();
    for (const issue of filesystemIssues) filesystemBySource.set(issue.sourcePath, [...(filesystemBySource.get(issue.sourcePath) ?? []), issue]);
    const items = renamePlan.items.map((item) => ({
      ...item,
      issues: [...item.issues, ...(filesystemBySource.get(item.sourcePath) ?? [])],
      companions: item.companions.map((companion) => ({ ...companion, issues: [...companion.issues, ...(filesystemBySource.get(companion.sourcePath) ?? [])] })),
    }));
    const itemIssues = (item: typeof items[number]) => [...item.issues, ...item.companions.flatMap((companion) => companion.issues)];
    const issues = items.flatMap(itemIssues);
    return {
      ...renamePlan,
      items,
      issues,
      readyCount: items.filter((item) => item.targetPath && !itemIssues(item).some((issue) => issue.severity === 'error' || issue.code === 'no-change')).length,
      blockedCount: items.filter((item) => itemIssues(item).some((issue) => issue.severity === 'error')).length,
      warningCount: issues.filter((issue) => issue.severity === 'warning').length,
    };
  }, [filesystemIssues, renamePlan]);
  const planIssuesByPath = useMemo(() => new Map(preflightPlan.items.map((item) => [item.sourcePath, [...item.issues, ...item.companions.flatMap((companion) => companion.issues)]])), [preflightPlan]);
  const planItemsByPath = useMemo(() => new Map(preflightPlan.items.map((item) => [item.sourcePath, item])), [preflightPlan]);
  const companionCount = preflightPlan.items.reduce((total, item) => total + item.companions.length, 0);

  useEffect(() => {
    localStorage.setItem('media-renamer-episode-template', episodeTemplate);
  }, [episodeTemplate]);

  useEffect(() => {
    localStorage.setItem('media-renamer-file-view-mode', fileViewMode);
  }, [fileViewMode]);

  useEffect(() => {
    if (tvBaseFolder) localStorage.setItem('media-renamer-tv-base-folder', tvBaseFolder);
    else localStorage.removeItem('media-renamer-tv-base-folder');
  }, [tvBaseFolder]);

  useEffect(() => {
    localStorage.setItem('media-renamer-show-folder-template', showFolderTemplate);
  }, [showFolderTemplate]);

  useEffect(() => {
    if (movieBaseFolder) localStorage.setItem('media-renamer-movie-base-folder', movieBaseFolder);
    else localStorage.removeItem('media-renamer-movie-base-folder');
  }, [movieBaseFolder]);

  useEffect(() => {
    localStorage.setItem('media-renamer-movie-folder-template', movieFolderTemplate);
  }, [movieFolderTemplate]);

  useEffect(() => {
    const candidates = renamePlan.items.flatMap((item) => [item, ...item.companions].flatMap((entry) => entry.targetPath ? [{ sourcePath: entry.sourcePath, targetPath: entry.targetPath }] : []));
    if (!window.mediaRenamer?.preflightRenamePlan || !candidates.length) {
      setFilesystemIssues([]);
      setCheckingPlan(false);
      return;
    }
    let active = true;
    setCheckingPlan(true);
    window.mediaRenamer.preflightRenamePlan(candidates).then((issues) => {
      if (active) setFilesystemIssues(issues);
    }).catch((reason) => {
      if (!active) return;
      const message = errorMessage(reason);
      setError(message);
      addDebug('error', 'Rename preflight failed', message);
    }).finally(() => { if (active) setCheckingPlan(false); });
    return () => { active = false; };
  }, [addDebug, renamePlan]);

  useEffect(() => {
    if (!window.mediaRenamer?.discoverCompanions || !paths.length) {
      setCompanionScan({ byVideo: {}, ambiguous: [] });
      return;
    }
    let active = true;
    window.mediaRenamer.discoverCompanions(paths).then((scan) => {
      if (!active) return;
      setCompanionScan(scan);
      const count = Object.values(scan.byVideo).reduce((total, companions) => total + companions.length, 0);
      if (count) addDebug('success', `Found ${count} companion file${count === 1 ? '' : 's'}`, 'Subtitles, metadata, and episode artwork will follow their parent videos.');
      if (scan.ambiguous.length) addDebug('warning', `${scan.ambiguous.length} ambiguous companion file${scan.ambiguous.length === 1 ? '' : 's'}`, 'Review the competing video names before renaming.');
    }).catch((reason) => {
      if (!active) return;
      const message = errorMessage(reason);
      addDebug('warning', 'Could not scan companion files', message);
    });
    return () => { active = false; };
  }, [addDebug, paths]);

  useEffect(() => {
    if (!window.mediaRenamer?.probeMedia) return;
    const pending = paths.filter((path) => !probedPaths.current.has(path));
    if (!pending.length) return;
    void inspectMedia(pending);
  }, [inspectMedia, paths]);

  useEffect(() => {
    if (!preferencesOpen && !refreshConfirmation && !clearConfirmation && !batchMetadataOpen && !reviewingPath && !pinnedPreviewPath) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPreferencesOpen(false); setRefreshConfirmation(false); setClearConfirmation(false); setBatchMetadataOpen(false); setReviewingPath(undefined); setPinnedPreviewPath(undefined); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [preferencesOpen, refreshConfirmation, clearConfirmation, batchMetadataOpen, reviewingPath, pinnedPreviewPath]);

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
      setMatchOverrides({});
      setConfirmedPaths(new Set());
      setReviewingPath(undefined);
      setPinnedPreviewPath(undefined);
      setWork(undefined);
      return;
    }

    const worker = new Worker(new URL('./workers/matchWorker.ts', import.meta.url), { type: 'module' });
    setMatchOverrides({});
    setConfirmedPaths(new Set());
    setReviewingPath(undefined);
    setPinnedPreviewPath(undefined);
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
      setShow({ ...details, tvdbId: details.tvdbId ?? result.tvdbId });
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

  async function chooseBaseFolder(kind: 'TV' | 'Movie') {
    try {
      const selected = await window.mediaRenamer?.pickDestinationFolder();
      if (selected) (kind === 'TV' ? setTvBaseFolder : setMovieBaseFolder)(selected);
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      addDebug('error', `Could not choose ${kind} base folder`, message);
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

  async function exportPlan() {
    if (!window.mediaRenamer?.exportRenamePlan || !paths.length || checkingPlan) return;
    try {
      const exportedPath = await window.mediaRenamer.exportRenamePlan({ ...preflightPlan, generatedAt: new Date().toISOString() });
      if (exportedPath) addDebug('success', 'Exported rename plan', exportedPath);
      else addDebug('info', 'Rename plan export cancelled');
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      addDebug('error', 'Could not export rename plan', message);
    }
  }

  function clearBatch() {
    for (const path of paths) probeRuns.current[path] = (probeRuns.current[path] ?? 0) + 1;
    probedPaths.current.clear();
    setPaths([]);
    setMatches([]);
    setMatchOverrides({});
    setConfirmedPaths(new Set());
    setTechnicalTags({});
    setCompanionScan({ byVideo: {}, ambiguous: [] });
    setProbeStates({});
    setFilesystemIssues([]);
    setSourceOverride('auto');
    setAiUpscaleOverride('auto');
    setMoveFiles(true);
    setWork(undefined);
    setBatchMetadataOpen(false);
    setReviewingPath(undefined);
    setPinnedPreviewPath(undefined);
    setClearConfirmation(false);
    addDebug('info', 'Cleared imported media', `${paths.length} file${paths.length === 1 ? '' : 's'} removed from the current batch. No files were changed on disk.`);
  }

  function openMatchReview(path: string) {
    const item = matchesByPath.get(path);
    setReviewingPath(path);
    setReviewSearch('');
    setReviewCandidate(item?.match);
  }

  function confirmMatchReview() {
    if (!reviewingPath || !reviewCandidate) return;
    setMatchOverrides((current) => ({ ...current, [reviewingPath]: reviewCandidate }));
    setConfirmedPaths((current) => new Set(current).add(reviewingPath));
    addDebug('success', `Confirmed ${filenameFromPath(reviewingPath)} → ${episodeCode(reviewCandidate.episode)} ${reviewCandidate.episode.title}`, reviewCandidate.reasons.join('; ') || 'Manually confirmed.');
    setReviewingPath(undefined);
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
        <div className="topbar-actions">
          <button className={`icon-button ${preferencesOpen ? 'active' : ''}`} aria-label="Open preferences" title="Preferences" onClick={() => setPreferencesOpen(true)}><Settings size={18}/></button>
          <button className={`icon-button ${debugDocked ? 'active' : ''}`} aria-label="Toggle docked debug console" title="Toggle debug console" onClick={() => { if (debugDocked) setDebugDocked(false); else { setDebugDocked(true); void window.mediaRenamer?.dockDebugConsole(); } }}><SquareTerminal size={18}/></button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="show-identity">
            {show?.posterUrl && <img className="show-poster" src={show.posterUrl} alt=""/>}
            <div>
              <p className="eyebrow">ACTIVE SHOW</p>
              {show?.logoUrl && <img className="show-logo" src={show.logoUrl} alt=""/>}
              <h1>{show ? <>{show.name} {show.year && <span>({show.year})</span>}</> : 'Choose a TV show'}</h1>
              <p>{show ? `${episodes.length} episodes · ${show.seasons.length} seasons · TMDB` : 'Search TMDB to load real episode metadata'}</p>
            </div>
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

          <section className={`match-panel panel ${fileDropActive ? 'drop-active' : ''}`} onDragEnter={enterFileDropTarget} onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} onDragLeave={leaveFileDropTarget} onDrop={dropFilesOnPanel}>
            <div className="panel-heading main-heading">
              <div><p className="eyebrow">MATCH &amp; REVIEW</p><h2>{paths.length} imported files</h2></div>
              <div className="add-actions"><button className={`secondary ${moveFiles ? 'active' : ''}`} aria-pressed={moveFiles} title={moveFiles ? tvBaseFolder ? `Move renamed files into ${tvBaseFolder}` : 'Move files when a TV base folder is configured' : 'Rename files in their current folders'} onClick={() => setMoveFiles((enabled) => !enabled)}><FolderTree size={15}/>{moveFiles ? 'Move files' : 'In place'}</button><button className={`secondary ${sourceOverride !== 'auto' || aiUpscaleOverride !== 'auto' ? 'active' : ''}`} aria-expanded={batchMetadataOpen} onClick={() => setBatchMetadataOpen((open) => !open)}><SlidersHorizontal size={15}/> Batch metadata{(sourceOverride !== 'auto' || aiUpscaleOverride !== 'auto') && <span className="active-indicator"/>}</button><button className="secondary" disabled={!paths.length || inspectingAny} onClick={() => setRefreshConfirmation(true)}><RefreshCw size={15}/> Refresh media</button><button className="secondary clear-batch" disabled={!paths.length} onClick={() => setClearConfirmation(true)}><Trash2 size={15}/> Clear all</button><button className="secondary" onClick={addFiles}><FolderOpen size={16}/> Add files</button><button className="secondary" onClick={addFolders}><FolderPlus size={16}/> Add folder</button></div>
            </div>
            {batchMetadataOpen && <><button className="batch-popover-backdrop" aria-label="Close batch metadata" onClick={() => setBatchMetadataOpen(false)}/><aside className="batch-popover" aria-label="Batch metadata">
              <div className="batch-popover-heading"><span><strong>Batch metadata</strong><small>Applies only to the current imported files</small></span><button aria-label="Close batch metadata" onClick={() => setBatchMetadataOpen(false)}><X size={15}/></button></div>
              <p>Auto keeps filename and parent-folder evidence. Use an override when the source material does not identify itself.</p>
              <div className="metadata-overrides">
                <label><span><strong>Source</strong><small>For example, an otherwise unidentified DVD encode.</small></span><select value={sourceOverride} onChange={(event) => setSourceOverride(event.target.value as Source | 'auto')}><option value="auto">Auto detect</option>{SOURCE_OPTIONS.map((source) => <option value={source} key={source}>{source}</option>)}</select></label>
                <label><span><strong>AI Upscale</strong><small>Auto checks filenames and every parent folder.</small></span><select value={aiUpscaleOverride} onChange={(event) => setAiUpscaleOverride(event.target.value as 'auto' | 'on' | 'off')}><option value="auto">Auto detect</option><option value="on">Yes</option><option value="off">No</option></select></label>
              </div>
              {(sourceOverride !== 'auto' || aiUpscaleOverride !== 'auto') && <button className="clear-overrides" onClick={() => { setSourceOverride('auto'); setAiUpscaleOverride('auto'); }}>Clear overrides</button>}
            </aside></>}
            {work && <div className="work-status" role="status" aria-live="polite">
              <LoaderCircle className="spin" size={18}/>
              <span><strong>{work.operation === 'Scanning' ? 'Scanning folders' : `${work.operation} files`}</strong><small>{work.total ? `${work.total - work.completed} of ${work.total} remaining` : 'Discovering video files…'}</small></span>
              {work.total > 0 && <progress value={work.completed} max={work.total}/>}
            </div>}
            {paths.length > 0 && <div className={`plan-status ${preflightPlan.blockedCount ? 'blocked' : 'ready'}`} role="status" aria-live="polite">
              {checkingPlan ? <LoaderCircle className="spin" size={18}/> : preflightPlan.blockedCount ? <TriangleAlert size={18}/> : <ShieldCheck size={18}/>}
              <span><strong>{checkingPlan ? 'Checking rename plan…' : preflightPlan.blockedCount ? `${preflightPlan.blockedCount} file${preflightPlan.blockedCount === 1 ? '' : 's'} blocked` : 'Rename plan passed preflight'}</strong><small>{preflightPlan.readyCount} ready · {companionCount} companion{companionCount === 1 ? '' : 's'} · {preflightPlan.warningCount} warning{preflightPlan.warningCount === 1 ? '' : 's'}{preflightPlan.destinationDirectories.length ? ` · ${preflightPlan.destinationDirectories.length} destination folder${preflightPlan.destinationDirectories.length === 1 ? '' : 's'}` : ''}{preflightPlan.blockedCount ? ' · Review or ambiguous files must be resolved' : ' · No collisions detected'}</small></span>
            </div>}
            {paths.length > 0 && <div className={`match-list view-${fileViewMode} ${pinnedPreviewPath ? 'has-pinned-preview' : ''}`}>
              {paths.map((path) => {
                const item = matchesByPath.get(path);
                const filename = item?.filename ?? filenameFromPath(path);
                const tags = item ? applyReleaseOverrides({ ...item.tags, ...technicalTags[path] }, {
                  source: sourceOverride === 'auto' ? undefined : sourceOverride,
                  aiUpscale: aiUpscaleOverride === 'auto' ? undefined : aiUpscaleOverride === 'on',
                }) : undefined;
                const probeState = probeStates[path];
                const inspecting = probeState === 'loading';
                const extension = filename.match(/(\.[^.]+)$/)?.[1] ?? '';
                const plannedTargetName = planItemsByPath.get(path)?.targetName;
                const plannedCompanions = planItemsByPath.get(path)?.companions ?? [];
                const output = plannedTargetName ? extension ? plannedTargetName.slice(0, -extension.length) : plannedTargetName : formatError ? 'Fix the filename template' : moveFiles && tvBaseFolder && folderFormatError ? 'Fix the show folder pattern' : 'No suggested name';
                const status = item?.status ?? 'pending';
                const confirmed = confirmedPaths.has(path);
                const detailTags = tags ? [tags.resolution, tags.source !== 'Unknown' ? tags.source : undefined, tags.videoCodec, tags.audioCodec, tags.channels, ...tags.flags, tags.group].filter(Boolean) : [];
                const planIssues = planIssuesByPath.get(path) ?? [];
                const blockingIssue = planIssues.find((issue) => issue.severity === 'error');
                const fullProposedName = plannedTargetName ?? (item ? output : 'Waiting for show metadata');
                const previewPinned = pinnedPreviewPath === path;
                return <article className={`match-row ${previewPinned ? 'preview-pinned' : ''}`} key={path}>
                  <div className={`status-dot ${inspecting ? 'inspecting' : confirmed ? 'confirmed' : status}`}>{inspecting ? <LoaderCircle className="spin"/> : confirmed || status === 'confident' ? <Check/> : status === 'review' ? '!' : status === 'unmatched' ? <X/> : '…'}</div>
                  <div className="file-content" tabIndex={fileViewMode === 'detailed' ? undefined : 0} role={fileViewMode === 'detailed' ? undefined : 'button'} aria-expanded={fileViewMode === 'detailed' ? undefined : previewPinned} aria-label={fileViewMode === 'detailed' ? undefined : `Show complete filenames for ${filename}`} onClick={() => { if (fileViewMode !== 'detailed') setPinnedPreviewPath((current) => current === path ? undefined : path); }} onKeyDown={(event) => { if (fileViewMode !== 'detailed' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setPinnedPreviewPath((current) => current === path ? undefined : path); } }}>
                    <div className="file-pair"><div className="original"><FileVideo size={15}/><span>{filename}</span></div><div className="arrow"><ChevronRight size={15}/></div><div className="proposed">{item ? output : 'Waiting for show metadata'}<span>{item?.match ? extension : ''}</span>{inspecting && <em>Inspecting video &amp; audio…</em>}{probeState === 'error' && <em className="probe-error">Media details unavailable</em>}{blockingIssue && <em className="plan-error">{blockingIssue.message}</em>}</div></div>
                    {fileViewMode === 'detailed' && <div className="file-details">
                      {planIssues.length ? <span className={`match-reasons ${blockingIssue ? 'has-error' : ''}`}>{planIssues.map((issue) => issue.message).join(' ')}</span> : item?.match?.reasons.length ? <span className="match-reasons">Matched by {item.match.reasons.join(' + ')}</span> : <span className="match-reasons">No match evidence</span>}
                      <span className="detail-tags">{detailTags.length ? detailTags.map((tag, index) => <small key={`${tag}-${index}`}>{tag}</small>) : <small>No release metadata</small>}</span>
                    </div>}
                    {plannedCompanions.length > 0 && (fileViewMode === 'compact' ? <div className="companion-summary">{plannedCompanions.length} companion file{plannedCompanions.length === 1 ? '' : 's'}</div> : <div className="companion-files">
                      {plannedCompanions.map((companion) => <div key={companion.sourcePath}>
                        {companion.kind === 'subtitle' ? <Captions size={12}/> : companion.kind === 'artwork' ? <FileImage size={12}/> : <FileText size={12}/>}
                        <span title={companion.sourceName}>{companion.sourceName}</span><ChevronRight size={11}/><strong title={companion.targetName}>{companion.targetName ?? 'Waiting for episode match'}</strong>
                      </div>)}
                    </div>)}
                    {fileViewMode !== 'detailed' && <div className="filename-preview" onClick={(event) => { event.stopPropagation(); if (!previewPinned) setPinnedPreviewPath(path); }}>
                      <div><span>Original</span><code>{filename}</code></div>
                      <div><span>Proposed</span><code>{fullProposedName}</code></div>
                      {previewPinned && <button aria-label="Close filename preview" title="Close preview" onClick={(event) => { event.stopPropagation(); setPinnedPreviewPath(undefined); }}><X size={13}/></button>}
                    </div>}
                  </div>
                  <div className="row-trailing"><div className="score"><strong>{item ? `${Math.round((item.match?.score ?? 0) * 100)}%` : '—'}</strong><small>{inspecting ? 'inspecting' : confirmed ? 'confirmed' : status}</small></div><button className={`row-review ${!confirmed && (status === 'review' || status === 'unmatched') ? 'required' : ''}`} aria-label={`Review episode match for ${filename}`} title="Review episode match" disabled={!item} onClick={() => openMatchReview(path)}><ListChecks size={14}/></button><button className="row-refresh" aria-label={`Refresh media information for ${filename}`} title="Refresh media information" disabled={inspecting} onClick={() => void inspectMedia([path])}><RefreshCw className={inspecting ? 'spin' : ''} size={14}/></button></div>
                </article>;
              })}
            </div>}
            {paths.length === 0 && <button className="dropzone dropzone-empty" onClick={addFiles}><FolderOpen size={30}/><span>Drop files or folders anywhere in this panel</span><small>or click to choose video files</small></button>}
            {paths.length > 0 && <div className="drop-target-overlay" aria-hidden="true"><FolderPlus size={30}/><strong>Add files or folders</strong><small>Drop anywhere in this panel</small></div>}
          </section>
        </section>
      </main>

      <footer><div><span className="legend confident"></span>{preflightPlan.readyCount} ready <span className="legend review"></span>{preflightPlan.blockedCount} blocked <span className="tmdb-attribution">This product uses the TMDB API but is not endorsed or certified by TMDB.</span></div><div><button className="secondary" disabled={!paths.length || checkingPlan} onClick={() => void exportPlan()}>Export plan</button><button className="primary" disabled>Rename {preflightPlan.readyCount} files <ChevronRight size={16}/></button></div></footer>

      {refreshConfirmation && <div className="confirmation-layer" role="presentation">
        <button className="confirmation-backdrop" aria-label="Cancel media refresh" onClick={() => setRefreshConfirmation(false)}/>
        <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="refresh-title" aria-describedby="refresh-description">
          <span className="confirmation-icon"><RefreshCw size={20}/></span>
          <h2 id="refresh-title">Refresh all media information?</h2>
          <p id="refresh-description">This will read the video and audio streams for all {paths.length} imported file{paths.length === 1 ? '' : 's'}. It may take a while for large libraries.</p>
          <div><button className="secondary" autoFocus onClick={() => setRefreshConfirmation(false)}>Cancel</button><button className="primary" onClick={() => { setRefreshConfirmation(false); void inspectMedia(paths); }}><RefreshCw size={15}/> Refresh all</button></div>
        </section>
      </div>}

      {clearConfirmation && <div className="confirmation-layer" role="presentation">
        <button className="confirmation-backdrop" aria-label="Cancel clearing imported media" onClick={() => setClearConfirmation(false)}/>
        <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-description">
          <span className="confirmation-icon destructive"><Trash2 size={20}/></span>
          <h2 id="clear-title">Clear all imported media?</h2>
          <p id="clear-description">This removes {paths.length} file{paths.length === 1 ? '' : 's'} from the current batch and clears its match decisions and metadata overrides. Files on disk will not be changed.</p>
          <div><button className="secondary" autoFocus onClick={() => setClearConfirmation(false)}>Cancel</button><button className="primary destructive" onClick={clearBatch}><Trash2 size={15}/> Clear all</button></div>
        </section>
      </div>}

      {reviewingPath && reviewingItem && <div className="review-layer">
        <button className="review-backdrop" aria-label="Close match review" onClick={() => setReviewingPath(undefined)}/>
        <aside className="review-panel" aria-label="Review episode match">
          <div className="review-heading"><div><p className="eyebrow">MATCH REVIEW</p><h2>Choose an episode</h2></div><button className="icon-button" aria-label="Close match review" onClick={() => setReviewingPath(undefined)}><X size={18}/></button></div>
          <div className="review-file"><FileVideo size={17}/><span><strong>{reviewingItem.filename}</strong><small>Confirm the suggestion or search every episode in this show.</small></span></div>
          <label className="review-search"><Search size={15}/><input value={reviewSearch} onChange={(event) => setReviewSearch(event.target.value)} placeholder="Search by S03E12 or episode title" autoFocus/></label>
          <div className="review-results-heading"><strong>{reviewSearch.trim() ? 'Search results' : 'Suggested matches'}</strong><small>{reviewCandidates.length} episode{reviewCandidates.length === 1 ? '' : 's'}</small></div>
          <div className="review-candidates">
            {reviewCandidates.map((candidate) => {
              const selected = reviewCandidate?.episode.id === candidate.episode.id;
              const manual = candidate.reasons.includes('manually selected');
              return <button key={candidate.episode.id} className={selected ? 'selected' : ''} onClick={() => setReviewCandidate(candidate)}>
                <span className="candidate-code">{episodeCode(candidate.episode)}</span>
                <span><strong>{candidate.episode.title}</strong><small>{manual ? 'Manual selection' : candidate.reasons.join(' · ') || 'No matching evidence'}</small></span>
                <span className="candidate-score">{manual ? 'Manual' : `${Math.round(candidate.score * 100)}%`}</span>
                {selected && <Check size={15}/>}
              </button>;
            })}
            {reviewCandidates.length === 0 && <div className="review-empty">No episodes match that search.</div>}
          </div>
          <div className="review-footer"><span><FileCheck2 size={15}/> Confirmation is recorded for this matching run.</span><button className="primary" disabled={!reviewCandidate} onClick={confirmMatchReview}>Confirm match</button></div>
        </aside>
      </div>}

      {preferencesOpen && <div className="preferences-layer">
        <button className="preferences-backdrop" aria-label="Close preferences" onClick={() => setPreferencesOpen(false)}/>
        <aside className="preferences-panel" aria-label="Preferences">
          <div className="preferences-heading"><div><p className="eyebrow">SETTINGS</p><h2>Preferences</h2></div><button className="icon-button" aria-label="Close preferences" onClick={() => setPreferencesOpen(false)}><X size={18}/></button></div>
          <section className="preference-section"><h3>Appearance</h3><p>Choose how Media Renamer looks.</p><div className="theme-switcher" role="group" aria-label="Appearance">
            {([['system', Monitor, 'Automatic'], ['light', Sun, 'Light'], ['dark', Moon, 'Dark']] as const).map(([value, Icon, label]) => (
              <button key={value} className={preference === value ? 'active' : ''} aria-label={`${label} appearance`} aria-pressed={preference === value} onClick={() => setPreference(value)}><Icon size={15}/><span>{label}</span></button>
            ))}
          </div></section>
          <section className="preference-section"><h3>File list</h3><p>Choose how much information each imported file displays.</p><div className="view-mode-switcher" role="group" aria-label="File list view">
            {([['detailed', 'Detailed', 'Match evidence and detected media tags'], ['summary', 'Summary', 'Current filename and proposed filename'], ['compact', 'Compact', 'Short rows for larger batches']] as const).map(([value, label, description]) => (
              <button key={value} className={fileViewMode === value ? 'active' : ''} aria-pressed={fileViewMode === value} onClick={() => setFileViewMode(value)}><strong>{label}</strong><small>{description}</small></button>
            ))}
          </div></section>
          <section className={`preference-section destination-settings ${folderFormatError ? 'invalid' : ''}`}><h3>TV destination</h3><p>Optionally move renamed episodes into a show folder beneath a dedicated TV library.</p>
            <div className="destination-row"><span><strong>TV base folder</strong><small>{tvBaseFolder || 'Keep episodes beside their sources'}</small></span><span className="destination-actions"><button className="secondary" onClick={() => void chooseBaseFolder('TV')}><FolderTree size={14}/>{tvBaseFolder ? 'Change' : 'Choose'}</button>{tvBaseFolder && <button className="icon-button" aria-label="Clear TV base folder" title="Keep episodes beside their sources" onClick={() => setTvBaseFolder('')}><X size={14}/></button>}</span></div>
            <label className="folder-template-field"><span><strong>Show folder pattern</strong><small>Supports show.name, show.year, show.tvdbId, and nested folders.</small></span><input value={showFolderTemplate} onChange={(event) => setShowFolderTemplate(event.target.value)} spellCheck={false}/></label>
            {folderFormatError ? <small className="format-error">{folderFormatError}</small> : tvBaseFolder && <div className="destination-preview"><span>Preview</span><code>{joinPath(tvBaseFolder, show ? formatShowFolder(showFolderTemplate, show.name, show.year, show.tvdbId) : formatShowFolder(showFolderTemplate, 'Show Name', 2026, '74550'))}</code></div>}
          </section>
          <section className={`preference-section destination-settings ${movieFolderFormatError ? 'invalid' : ''}`}><h3>Movie destination</h3><p>Configure the separate library destination that the upcoming movie workflow will use.</p>
            <div className="destination-row"><span><strong>Movie base folder</strong><small>{movieBaseFolder || 'Keep movies beside their sources'}</small></span><span className="destination-actions"><button className="secondary" onClick={() => void chooseBaseFolder('Movie')}><FolderTree size={14}/>{movieBaseFolder ? 'Change' : 'Choose'}</button>{movieBaseFolder && <button className="icon-button" aria-label="Clear movie base folder" title="Keep movies beside their sources" onClick={() => setMovieBaseFolder('')}><X size={14}/></button>}</span></div>
            <label className="folder-template-field"><span><strong>Movie folder pattern</strong><small>Supports movie.name, movie.year, movie.tmdbId, and nested folders.</small></span><input value={movieFolderTemplate} onChange={(event) => setMovieFolderTemplate(event.target.value)} spellCheck={false}/></label>
            {movieFolderFormatError ? <small className="format-error">{movieFolderFormatError}</small> : movieBaseFolder && <div className="destination-preview"><span>Preview</span><code>{joinPath(movieBaseFolder, formatMovieFolder(movieFolderTemplate, 'Movie Name', 2026, '123456'))}</code></div>}
          </section>
          <section className="preference-section"><h3>Episode matching</h3><label className="preference-toggle"><span><Sparkles size={17}/><span><strong>Match episode names</strong><small>Best effort when numbering and titles disagree</small></span></span><input type="checkbox" checked={titleMatching} onChange={(event) => { setTitleMatching(event.target.checked); addDebug('info', `Episode-title matching ${event.target.checked ? 'enabled' : 'disabled'}`); }}/></label></section>
          <section className={`preference-section format-editor ${formatError ? 'invalid' : ''}`}>
            <div className="format-heading"><span><h3>Filename template</h3><p>Lay it out like a script. Runs of whitespace and indentation become one filename space.</p></span><button onClick={() => setEpisodeTemplate(DEFAULT_EPISODE_TEMPLATE)} disabled={episodeTemplate === DEFAULT_EPISODE_TEMPLATE}>Reset</button></div>
            <TemplateEditor value={episodeTemplate} onChange={setEpisodeTemplate}/>
            {formatError ? <small className="format-error">{formatError}</small> : <small className="format-help"><code>{'{{show.name}}'}</code> <code>{'{{show.tvdbId}}'}</code> <code>{'{{episode.range}}'}</code> <code>{'{{#episodes}}…{{/episodes}}'}</code> <code>{'{{technical}}'}</code> <code>{'{{release.audioCodec}}'}</code></small>}
            {formatExample && <div className="format-preview"><span>Output</span><strong>{formatExample}.mkv</strong></div>}
            <details className="template-reference">
              <summary>Template reference <span>{TEMPLATE_FIELDS.reduce((total, group) => total + group.fields.length, 0)} variables</span></summary>
              <div className="syntax-legend">
                <div><code>{'{{field}}'}</code><span>Insert a value</span></div>
                <div><code>{'{{#field}}…{{/field}}'}</code><span>Show when present, or repeat a list</span></div>
                <div><code>{'{{^field}}…{{/field}}'}</code><span>Show when empty or false</span></div>
              </div>
              {TEMPLATE_FIELDS.map((group) => <section className="variable-group" key={group.label}>
                <h4>{group.label}</h4>
                <div className="variable-list">{group.fields.map((field) => <div className="variable-row" key={field.name}>
                  <code>{`{{${field.name}}}`}</code><span>{field.description}</span><samp>{field.example}</samp>
                </div>)}</div>
              </section>)}
            </details>
          </section>
        </aside>
      </div>}

      {debugDocked && (
        <DebugPanel entries={debugEntries} mode="docked" dockPosition={dockPosition} onDockPositionChange={setDockPosition} onResizeStart={beginDockResize} onClear={() => void window.mediaRenamer?.clearDebugEntries()} onPopout={() => {
          setDebugDocked(false);
          void window.mediaRenamer?.openDebugConsole();
        }}/>
      )}
    </div>
  );
}
