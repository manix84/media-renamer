import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type UIEvent } from 'react';
import { AlertCircle, Captions, Check, ChevronRight, FileCheck2, FileImage, FileText, FileVideo, Film, FolderOpen, FolderPlus, FolderTree, ListChecks, LoaderCircle, Monitor, Moon, RefreshCw, RotateCcw, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, SquareTerminal, Sun, Trash2, TriangleAlert, Tv, X } from 'lucide-react';
import { DEFAULT_EPISODE_TEMPLATE, DEFAULT_MOVIE_FOLDER_TEMPLATE, DEFAULT_MOVIE_TEMPLATE, DEFAULT_SHOW_FOLDER_TEMPLATE, formatEpisode, formatEpisodeFilename, formatMovie, formatMovieFilename, formatMovieFolder, formatShowFolder, movieFolderTemplateError, movieTemplateError, PREVIOUS_DEFAULT_EPISODE_TEMPLATE, PREVIOUS_TVDB_DEFAULT_EPISODE_TEMPLATE, showFolderTemplateError, templateError } from './core/formatter';
import { createRenamePlan, destinationDirectoryForSource } from './core/renamePlan';
import { applyReleaseOverrides, parseReleaseTags } from './core/releaseTags';
import { formatSeasonLabel } from './core/seasonLabel';
import { inferShowQuery } from './core/showInference';
import type { CompanionScan, Episode, FileMatch, MatchCandidate, MediaTechnicalTags, MovieDetails, ProviderStatus, RenamePlanIssue, ShowDetails, ShowSearchResult, Source } from './core/types';
import { DebugPanel, type DebugEntry, type DockPosition } from './DebugConsole';
import { useTheme } from './theme';

type WorkProgress = { operation: 'Scanning' | 'Importing' | 'Renaming' | 'Undoing'; completed: number; total: number };
type RenameOperationRecord = { operation: { id: string; status: 'completed' | 'undone'; items: Array<{ sourcePath: string; targetPath: string }> }; logPath: string };
type DebugLevel = 'info' | 'success' | 'warning' | 'error';
type TemplateField = { name: string; description: string; example: string };
type FileViewMode = 'detailed' | 'summary' | 'compact';
type PreferenceMediaTab = 'shows' | 'movies';

const TEMPLATE_FIELDS: Array<{ label: string; fields: TemplateField[] }> = [
  { label: 'Show', fields: [
    { name: 'show.name', description: 'Series title', example: 'Star Trek: The Next Generation' },
    { name: 'show.year', description: 'Premiere year, when known', example: '1987' },
    { name: 'show.tvdbId', description: 'Canonical TVDB series ID', example: '71470' },
  ] },
  { label: 'Episode', fields: [
    { name: 'episode.range', description: 'Combined season and episode range', example: 'S01E01-E02' },
    { name: 'episodes', description: 'Repeating section for merged episodes', example: '2 items' },
    { name: 'title', description: 'Title inside an episodes section', example: 'Encounter at Farpoint' },
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
const MOVIE_TEMPLATE_FIELDS: Array<{ label: string; fields: TemplateField[] }> = [
  { label: 'Movie', fields: [
    { name: 'movie.name', description: 'Movie title', example: 'Blade Runner: 2049' },
    { name: 'movie.year', description: 'Release year, when known', example: '2017' },
    { name: 'movie.tmdbId', description: 'Canonical TMDB movie ID', example: '335984' },
  ] },
  TEMPLATE_FIELDS.find((group) => group.label === 'Release')!,
];
const SHOW_FOLDER_FIELDS: TemplateField[] = [
  { name: 'show.name', description: 'Series title', example: 'Star Trek: The Next Generation' },
  { name: 'show.year', description: 'Premiere year', example: '1987' },
  { name: 'show.tvdbId', description: 'TVDB series ID', example: '71470' },
  { name: 'season', description: 'Unpadded season number', example: '5' },
  { name: 'seasonPadded', description: 'Two-digit season number', example: '05' },
  { name: 'seasonFolder', description: 'Season folder or Specials', example: 'Season 5' },
  { name: 'isSpecial', description: 'True for season zero', example: 'false' },
];
const MOVIE_FOLDER_FIELDS: TemplateField[] = [
  { name: 'movie.name', description: 'Movie title', example: 'Blade Runner: 2049' },
  { name: 'movie.year', description: 'Release year', example: '2017' },
  { name: 'movie.tmdbId', description: 'TMDB movie ID', example: '335984' },
];

const SOURCE_OPTIONS: Source[] = ['DVD', 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'DVDRip', 'TVRip'];

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

function filenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function isVideoPath(filePath: string): boolean {
  return /\.(?:mkv|mp4|avi|m4v|mov|webm)$/i.test(filePath);
}

function episodeCode(episode: Episode): string {
  return `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`;
}

function joinPath(directory: string, relativePath: string): string {
  if (!relativePath) return directory.replace(/[\\/]+$/, '');
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return `${directory.replace(/[\\/]+$/, '')}${separator}${relativePath.replace(/[\\/]+/g, separator)}`;
}

function fullSizeArtworkUrl(url: string): string {
  return url.replace(/\/t\/p\/(?:w\d+|h\d+|original)\//, '/t/p/original/');
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

function ReferenceVariables({ fields }: { fields: Array<{ label: string; fields: TemplateField[] }> }) {
  return <>
    <div className="syntax-legend">
      <div><code>{'{{field}}'}</code><span>Insert a value</span></div>
      <div><code>{'{{#field}}…{{/field}}'}</code><span>Show when present, or repeat a list</span></div>
      <div><code>{'{{^field}}…{{/field}}'}</code><span>Show when empty or false</span></div>
    </div>
    {fields.map((group) => <section className="variable-group" key={group.label}>
      <h4>{group.label}</h4>
      <div className="variable-list">{group.fields.map((field) => <div className="variable-row" key={field.name}>
        <code>{`{{${field.name}}}`}</code><span>{field.description}</span><samp>{field.example}</samp>
      </div>)}</div>
    </section>)}
  </>;
}

function TemplateReferencePanel({ tab, onClose }: { tab: PreferenceMediaTab; onClose: () => void }) {
  const shows = tab === 'shows';
  const filenameFields = shows ? TEMPLATE_FIELDS : MOVIE_TEMPLATE_FIELDS;
  const folderFields = shows ? SHOW_FOLDER_FIELDS : MOVIE_FOLDER_FIELDS;
  return <aside className="template-reference-popout" aria-label={`${shows ? 'Shows' : 'Movies'} template reference`}>
    <div className="template-reference-heading"><div><p className="eyebrow">{shows ? 'SHOWS' : 'MOVIES'}</p><h2>Template reference</h2></div><button className="icon-button" aria-label="Close template reference" onClick={onClose}><X size={18}/></button></div>
    <div className="template-reference-content">
      <section className="reference-scope"><h3>Destination folder</h3><p>Available in the {shows ? 'show' : 'movie'} folder pattern.</p><ReferenceVariables fields={[{ label: 'Folder fields', fields: folderFields }]}/></section>
      <section className="reference-scope"><h3>{shows ? 'Episode' : 'Movie'} filename</h3><p>Available in the filename template.</p><ReferenceVariables fields={filenameFields}/></section>
    </div>
  </aside>;
}

export default function App() {
  const { preference, setPreference } = useTheme();
  const [paths, setPaths] = useState<string[]>([]);
  const [titleMatching, setTitleMatching] = useState(true);
  const [sourceOverride, setSourceOverride] = useState<Source | 'auto'>('auto');
  const [aiUpscaleOverride, setAiUpscaleOverride] = useState<'auto' | 'on' | 'off'>('auto');
  const [moveFiles, setMoveFiles] = useState(true);
  const [activeMediaTab, setActiveMediaTab] = useState<PreferenceMediaTab>('shows');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferenceMediaTab, setPreferenceMediaTab] = useState<PreferenceMediaTab>('shows');
  const [templateReferenceOpen, setTemplateReferenceOpen] = useState(false);
  const [batchMetadataOpen, setBatchMetadataOpen] = useState(false);
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);
  const [posterZoomed, setPosterZoomed] = useState(false);
  const [posterCanZoom, setPosterCanZoom] = useState(false);
  const [refreshConfirmation, setRefreshConfirmation] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [renameConfirmationOpen, setRenameConfirmationOpen] = useState(false);
  const [undoConfirmationOpen, setUndoConfirmationOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [lastRename, setLastRename] = useState<RenameOperationRecord>();
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>(() => {
    const saved = localStorage.getItem('media-renamer-file-view-mode');
    return saved === 'detailed' || saved === 'compact' ? saved : 'summary';
  });
  const [tvBaseFolder, setTvBaseFolder] = useState(() => localStorage.getItem('media-renamer-tv-base-folder') ?? '');
  const [showFolderTemplate, setShowFolderTemplate] = useState(() => localStorage.getItem('media-renamer-show-folder-template') ?? DEFAULT_SHOW_FOLDER_TEMPLATE);
  const [movieBaseFolder, setMovieBaseFolder] = useState(() => localStorage.getItem('media-renamer-movie-base-folder') ?? '');
  const [movieFolderTemplate, setMovieFolderTemplate] = useState(() => localStorage.getItem('media-renamer-movie-folder-template') ?? DEFAULT_MOVIE_FOLDER_TEMPLATE);
  const [movieTemplate, setMovieTemplate] = useState(() => localStorage.getItem('media-renamer-movie-template') ?? DEFAULT_MOVIE_TEMPLATE);
  const [episodeTemplate, setEpisodeTemplate] = useState(() => {
    const saved = localStorage.getItem('media-renamer-episode-template');
    return !saved || saved === PREVIOUS_DEFAULT_EPISODE_TEMPLATE || saved === PREVIOUS_TVDB_DEFAULT_EPISODE_TEMPLATE ? DEFAULT_EPISODE_TEMPLATE : saved;
  });
  const [provider, setProvider] = useState<ProviderStatus>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ShowSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [show, setShow] = useState<ShowDetails>();
  const [movie, setMovie] = useState<MovieDetails>();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [matchOverrides, setMatchOverrides] = useState<Record<string, MatchCandidate>>({});
  const [confirmedPaths, setConfirmedPaths] = useState<Set<string>>(() => new Set());
  const [reviewingPath, setReviewingPath] = useState<string>();
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewCandidate, setReviewCandidate] = useState<MatchCandidate>();
  const [pinnedPreviewPath, setPinnedPreviewPath] = useState<string>();
  const [removingPaths, setRemovingPaths] = useState<Set<string>>(() => new Set());
  const [fileDropActive, setFileDropActive] = useState(false);
  const [technicalTags, setTechnicalTags] = useState<Record<string, MediaTechnicalTags>>({});
  const [companionScan, setCompanionScan] = useState<CompanionScan>({ byVideo: {}, ambiguous: [] });
  const [probeStates, setProbeStates] = useState<Record<string, 'loading' | 'complete' | 'error'>>({});
  const [work, setWork] = useState<WorkProgress>();
  const [filesystemIssues, setFilesystemIssues] = useState<RenamePlanIssue[]>([]);
  const [resolvedTargets, setResolvedTargets] = useState<Record<string, string>>({});
  const [checkingPlan, setCheckingPlan] = useState(false);
  const [preflightError, setPreflightError] = useState<string>();
  const [preflightAttempt, setPreflightAttempt] = useState(0);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [error, setError] = useState<string>();
  const [debugDocked, setDebugDocked] = useState(() => localStorage.getItem('media-renamer-debug-docked') === 'true');
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [dockPosition, setDockPosition] = useState<DockPosition>(() => {
    const saved = localStorage.getItem('media-renamer-debug-dock-position');
    return saved === 'left' || saved === 'right' ? saved : 'bottom';
  });
  const [dockSizes, setDockSizes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('media-renamer-debug-dock-sizes') ?? 'null') as Partial<Record<DockPosition, unknown>> | null;
      const restoredSize = (value: unknown, fallback: number, maximum: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(170, Math.min(maximum, value)) : fallback;
      const sideMaximum = Math.max(170, window.innerWidth - 560);
      const bottomMaximum = Math.max(170, window.innerHeight - 300);
      return {
        left: restoredSize(saved?.left, Math.min(420, sideMaximum), sideMaximum),
        right: restoredSize(saved?.right, Math.min(420, sideMaximum), sideMaximum),
        bottom: restoredSize(saved?.bottom, Math.min(270, bottomMaximum), bottomMaximum),
      };
    } catch { return { left: 420, right: 420, bottom: 270 }; }
  });
  const searchSequence = useRef(0);
  const seasonSequence = useRef(0);
  const autoSelectResult = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const posterPreviewDialog = useRef<HTMLElement>(null);
  const posterPreviewImage = useRef<HTMLImageElement>(null);
  const probedPaths = useRef(new Set<string>());
  const probeRuns = useRef<Record<string, number>>({});
  const removalTimers = useRef<Record<string, number>>({});
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
  const attachedFileCountByEpisode = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of matchesByPath.values()) {
      if (!item.match) continue;
      counts.set(item.match.episode.id, (counts.get(item.match.episode.id) ?? 0) + 1);
    }
    return counts;
  }, [matchesByPath]);
  const confirmablePaths = useMemo(() => paths.filter((path) => {
    const item = matchesByPath.get(path);
    return Boolean(item?.match && item.status !== 'confident' && !confirmedPaths.has(path));
  }), [confirmedPaths, matchesByPath, paths]);
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
  const movieFormatError = movieTemplateError(movieTemplate);
  const exampleTags = applyReleaseOverrides({ source: 'WEB-DL', resolution: '1080p', videoCodec: 'H.264', audioCodec: 'AAC', channels: '2.0', flags: [] }, {
    source: sourceOverride === 'auto' ? undefined : sourceOverride,
    aiUpscale: aiUpscaleOverride === 'auto' ? undefined : aiUpscaleOverride === 'on',
  });
  const exampleEpisodes = [
    { id: 'example-1', season: 1, number: 1, title: 'Encounter at Farpoint' },
    { id: 'example-2', season: 1, number: 2, title: 'The Naked Now' },
  ];
  const singleEpisodeFormatExample = formatError ? undefined : formatEpisode(episodeTemplate, 'Star Trek: The Next Generation', 1987, exampleEpisodes[0], exampleTags, '71470');
  const multiEpisodeFormatExample = formatError ? undefined : formatEpisode(episodeTemplate, 'Star Trek: The Next Generation', 1987, exampleEpisodes, exampleTags, '71470');
  const movieFormatExample = movieFormatError ? undefined : formatMovie(movieTemplate, 'Blade Runner: 2049', 2017, exampleTags, '335984');
  const inspectingAny = paths.some((path) => probeStates[path] === 'loading');
  const ambiguousCompanionsByVideo = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const ambiguous of companionScan.ambiguous) for (const path of ambiguous.candidateVideoPaths) result.set(path, [...(result.get(path) ?? []), ambiguous.path]);
    return result;
  }, [companionScan.ambiguous]);
  const renamePlan = useMemo(() => createRenamePlan(paths.map((path) => {
    const item = matchesByPath.get(path);
    const baseTags = item?.tags ?? (activeMediaTab === 'movies' && movie ? parseReleaseTags(path) : undefined);
    const tags = baseTags ? applyReleaseOverrides({ ...baseTags, ...technicalTags[path] }, {
      source: sourceOverride === 'auto' ? undefined : sourceOverride,
      aiUpscale: aiUpscaleOverride === 'auto' ? undefined : aiUpscaleOverride === 'on',
    }) : undefined;
    const extension = filenameFromPath(path).match(/(\.[^.]+)$/)?.[1] ?? '';
    const showFolder = item?.match && show && !folderFormatError ? formatShowFolder(showFolderTemplate, show.name, show.year, show.tvdbId, item.match.episode.season) : undefined;
    const movieFolder = movie && !movieFolderFormatError ? formatMovieFolder(movieFolderTemplate, movie.name, movie.year, movie.id) : undefined;
    const companions = companionScan.byVideo[path] ?? [];
    const encoder = new TextEncoder();
    const extensionBytes = encoder.encode(extension).length;
    const longestCompanionSuffix = companions.reduce((longest, companion) => Math.max(longest, encoder.encode(companion.suffix).length), 0);
    const videoFilenameBudget = 255 - Math.max(0, longestCompanionSuffix - extensionBytes);
    const targetName = activeMediaTab === 'movies'
      ? movie && tags && !movieFormatError ? formatMovieFilename(movieTemplate, movie.name, movie.year, tags, extension, movie.id, videoFilenameBudget) : undefined
      : item?.match && show && tags && !formatError ? formatEpisodeFilename(episodeTemplate, show.name, show.year, item.match.episode, tags, extension, show.tvdbId, videoFilenameBudget) : undefined;
    return {
      sourcePath: path,
      targetName,
      targetDirectory: moveFiles && activeMediaTab === 'movies' && movieFolder !== undefined ? destinationDirectoryForSource(path, movieBaseFolder, movieFolder) : moveFiles && showFolder !== undefined ? destinationDirectoryForSource(path, tvBaseFolder, showFolder) : undefined,
      configurationError: moveFiles && activeMediaTab === 'movies' && movieFolderFormatError ? `Fix the movie folder pattern: ${movieFolderFormatError}` : moveFiles && activeMediaTab === 'shows' && folderFormatError ? `Fix the show folder pattern: ${folderFormatError}` : undefined,
      companionError: ambiguousCompanionsByVideo.get(path)?.length ? `${ambiguousCompanionsByVideo.get(path)!.length} companion file${ambiguousCompanionsByVideo.get(path)!.length === 1 ? '' : 's'} could belong to more than one imported video.` : undefined,
      companions,
      matchStatus: activeMediaTab === 'movies' && movie ? 'confident' : confirmedPaths.has(path) ? 'confident' : item?.status ?? 'pending',
      confidence: activeMediaTab === 'movies' && movie ? 1 : item?.match?.score ?? 0,
    };
  })), [activeMediaTab, aiUpscaleOverride, ambiguousCompanionsByVideo, companionScan.byVideo, confirmedPaths, episodeTemplate, folderFormatError, formatError, matchesByPath, moveFiles, movie, movieBaseFolder, movieFolderFormatError, movieFolderTemplate, movieFormatError, movieTemplate, paths, show, showFolderTemplate, sourceOverride, technicalTags, tvBaseFolder]);
  const renameGroups = useMemo(() => renamePlan.items.flatMap((item) => item.targetPath ? [{ items: [item, ...item.companions].flatMap((entry) => entry.targetPath ? [{ sourcePath: entry.sourcePath, targetPath: entry.targetPath }] : []) }] : []), [renamePlan]);
  const preflightPlan = useMemo(() => {
    const filesystemBySource = new Map<string, RenamePlanIssue[]>();
    for (const issue of filesystemIssues) filesystemBySource.set(issue.sourcePath, [...(filesystemBySource.get(issue.sourcePath) ?? []), issue]);
    const resolvedEntry = <T extends { sourcePath: string; targetPath?: string; targetName?: string; issues: RenamePlanIssue[] }>(entry: T): T => {
      const targetPath = resolvedTargets[entry.sourcePath] ?? entry.targetPath;
      return { ...entry, targetPath, targetName: targetPath ? filenameFromPath(targetPath) : entry.targetName, issues: entry.issues.filter((issue) => issue.code !== 'duplicate-target') };
    };
    const items = renamePlan.items.map((original) => {
      const item = resolvedEntry(original);
      return {
        ...item,
        issues: [...item.issues, ...(filesystemBySource.get(item.sourcePath) ?? [])],
        companions: original.companions.map((originalCompanion) => {
          const companion = resolvedEntry(originalCompanion);
          return { ...companion, issues: [...companion.issues, ...(filesystemBySource.get(companion.sourcePath) ?? [])] };
        }),
      };
    });
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
  }, [filesystemIssues, renamePlan, resolvedTargets]);
  const planIssuesByPath = useMemo(() => new Map(preflightPlan.items.map((item) => [item.sourcePath, [...item.issues, ...item.companions.flatMap((companion) => companion.issues)]])), [preflightPlan]);
  const planItemsByPath = useMemo(() => new Map(preflightPlan.items.map((item) => [item.sourcePath, item])), [preflightPlan]);
  const companionCount = preflightPlan.items.reduce((total, item) => total + item.companions.length, 0);
  const executableGroups = useMemo(() => preflightPlan.items.flatMap((item) => {
    const issues = [...item.issues, ...item.companions.flatMap((companion) => companion.issues)];
    if (!item.targetPath || issues.some((issue) => issue.severity === 'error' || issue.code === 'no-change')) return [];
    return [{ items: [item, ...item.companions].flatMap((entry) => entry.targetPath ? [{ sourcePath: entry.sourcePath, targetPath: entry.targetPath }] : []) }];
  }), [preflightPlan]);
  const executableFileCount = executableGroups.reduce((total, group) => total + group.items.length, 0);

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
    localStorage.setItem('media-renamer-movie-template', movieTemplate);
  }, [movieTemplate]);

  useEffect(() => {
    localStorage.setItem('media-renamer-debug-docked', String(debugDocked));
  }, [debugDocked]);

  useEffect(() => {
    localStorage.setItem('media-renamer-debug-dock-position', dockPosition);
  }, [dockPosition]);

  useEffect(() => {
    localStorage.setItem('media-renamer-debug-dock-sizes', JSON.stringify(dockSizes));
  }, [dockSizes]);

  useEffect(() => () => {
    for (const timer of Object.values(removalTimers.current)) window.clearTimeout(timer);
  }, []);

  const centerPosterPreview = useCallback(() => {
    const dialog = posterPreviewDialog.current;
    if (!dialog) return;
    dialog.scrollTo({
      left: Math.max(0, (dialog.scrollWidth - dialog.clientWidth) / 2),
      top: Math.max(0, (dialog.scrollHeight - dialog.clientHeight) / 2),
    });
  }, []);

  const updatePosterZoomAvailability = useCallback(() => {
    const image = posterPreviewImage.current;
    if (!image?.naturalWidth || !image.naturalHeight) return;
    const availableWidth = Math.max(1, window.innerWidth - 48);
    const availableHeight = Math.max(1, window.innerHeight - 112);
    const canZoom = image.naturalWidth > availableWidth || image.naturalHeight > availableHeight;
    setPosterCanZoom(canZoom);
    if (!canZoom) setPosterZoomed(false);
  }, []);

  useEffect(() => {
    if (!posterPreviewOpen) return;
    updatePosterZoomAvailability();
    window.addEventListener('resize', updatePosterZoomAvailability);
    return () => window.removeEventListener('resize', updatePosterZoomAvailability);
  }, [posterPreviewOpen, updatePosterZoomAvailability]);

  useEffect(() => {
    if (!posterZoomed) return;
    const frame = window.requestAnimationFrame(centerPosterPreview);
    return () => window.cancelAnimationFrame(frame);
  }, [centerPosterPreview, posterZoomed]);

  useEffect(() => {
    if (!window.mediaRenamer?.preflightRenamePlan || !window.mediaRenamer.resolveRenameCollisions || !renameGroups.length) {
      setFilesystemIssues([]);
      setResolvedTargets({});
      setCheckingPlan(false);
      setPreflightError(undefined);
      return;
    }
    let active = true;
    setCheckingPlan(true);
    setPreflightError(undefined);
    const withTimeout = <T,>(operation: Promise<T>) => Promise.race<T>([
      operation,
      new Promise<never>((_resolve, reject) => window.setTimeout(() => reject(new Error('The filesystem collision check timed out. The disk or network location may be unavailable.')), 15_000)),
    ]);
    withTimeout(window.mediaRenamer.resolveRenameCollisions(renameGroups)).then(async (groups) => {
      const candidates = groups.flatMap((group) => group.items);
      const issues = await withTimeout(window.mediaRenamer!.preflightRenamePlan(candidates));
      if (active) {
        setResolvedTargets(Object.fromEntries(candidates.map((item) => [item.sourcePath, item.targetPath])));
        setFilesystemIssues(issues);
      }
    }).catch((reason) => {
      if (!active) return;
      const message = errorMessage(reason);
      setError(message);
      setPreflightError(message);
      addDebug('error', 'Rename preflight failed', message);
    }).finally(() => { if (active) setCheckingPlan(false); });
    return () => { active = false; };
  }, [addDebug, preflightAttempt, renameGroups]);

  useEffect(() => window.mediaRenamer?.onRenameProgress((progress) => setWork({ operation: progress.operation === 'undo' ? 'Undoing' : 'Renaming', completed: progress.completed, total: progress.total })), []);

  useEffect(() => {
    let active = true;
    window.mediaRenamer?.getLastRenameOperation?.().then((operation) => { if (active) setLastRename(operation); }).catch((reason) => {
      if (active) addDebug('warning', 'Could not load rename history', errorMessage(reason));
    });
    return () => { active = false; };
  }, [addDebug]);

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
    if (!preferencesOpen && !refreshConfirmation && !clearConfirmation && !confirmAllOpen && !renameConfirmationOpen && !undoConfirmationOpen && !batchMetadataOpen && !posterPreviewOpen && !reviewingPath && !pinnedPreviewPath) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !renaming && !undoing) { setPreferencesOpen(false); setTemplateReferenceOpen(false); setRefreshConfirmation(false); setClearConfirmation(false); setConfirmAllOpen(false); setRenameConfirmationOpen(false); setUndoConfirmationOpen(false); setBatchMetadataOpen(false); setPosterPreviewOpen(false); setPosterZoomed(false); setReviewingPath(undefined); setPinnedPreviewPath(undefined); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [preferencesOpen, refreshConfirmation, clearConfirmation, confirmAllOpen, renameConfirmationOpen, undoConfirmationOpen, renaming, undoing, batchMetadataOpen, posterPreviewOpen, reviewingPath, pinnedPreviewPath]);

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
    if (activeMediaTab !== 'shows' || !provider?.configured || show || query.trim() || paths.length === 0) return;
    const inferred = inferShowQuery(paths);
    if (!inferred) {
      addDebug('warning', 'Could not infer a show name', 'No common SxxExx or 1x02 filename pattern was found.');
      return;
    }
    addDebug('info', `Inferred show query: ${inferred}`, `Derived from ${paths.length} imported file${paths.length === 1 ? '' : 's'}.`);
    autoSelectResult.current = true;
    setQuery(inferred);
  }, [activeMediaTab, addDebug, paths, provider?.configured, query, show]);

  useEffect(() => {
    if (activeMediaTab === 'movies') {
      setMatchOverrides({});
      setConfirmedPaths(new Set());
      setReviewingPath(undefined);
      setPinnedPreviewPath(undefined);
      setWork(undefined);
      setMatches(movie ? paths.map((path) => ({
        path,
        filename: filenameFromPath(path),
        tags: parseReleaseTags(path),
        match: { episode: { id: movie.id, season: 0, number: 0, title: movie.name }, score: 1, reasons: ['selected movie'] },
        alternatives: [],
        status: 'confident',
      })) : []);
      return;
    }
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
  }, [activeMediaTab, addDebug, movie, paths, episodes, titleMatching]);

  useEffect(() => {
    const trimmed = query.trim();
    const selectedName = activeMediaTab === 'movies' ? movie?.name : show?.name;
    if (!provider?.configured || trimmed.length < 2 || (selectedName && trimmed === selectedName)) {
      searchSequence.current += 1;
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
        const found = activeMediaTab === 'movies' ? await window.mediaRenamer?.searchMovies(trimmed) ?? [] : await window.mediaRenamer?.searchShows(trimmed) ?? [];
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
  }, [activeMediaTab, addDebug, movie?.name, provider?.configured, query, show?.name]);

  async function selectShow(result: ShowSearchResult) {
    if (activeMediaTab === 'movies') {
      setQuery(result.name);
      setResults([]);
      setError(undefined);
      addDebug('info', `Loading ${result.name}`, `TMDB movie ID ${result.id}.`);
      try {
        const details = await window.mediaRenamer?.getMovie(result.id);
        if (details) { setMovie(details); addDebug('success', `Loaded ${details.name}`, `${details.year ?? 'Release year unknown'} · TMDB movie metadata.`); }
      } catch (reason) {
        const message = errorMessage(reason);
        setError(message);
        setMovie(undefined);
        addDebug('error', `Could not load ${result.name}`, message);
      }
      return;
    }
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

  function clearShowSearch() {
    searchSequence.current += 1;
    seasonSequence.current += 1;
    autoSelectResult.current = false;
    setQuery('');
    setResults([]);
    setSearching(false);
    setShow(undefined);
    setMovie(undefined);
    setEpisodes([]);
    setLoadingEpisodes(false);
    searchInput.current?.focus();
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
      const selected = await window.mediaRenamer?.pickDestinationFolder(kind);
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
    if (!window.mediaRenamer?.exportRenamePlan || !paths.length || checkingPlan || preflightError) return;
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

  async function executeRenames() {
    if (!window.mediaRenamer?.executeRenamePlan || !executableGroups.length || preflightPlan.blockedCount || checkingPlan || preflightError || renaming) return;
    setRenaming(true);
    setError(undefined);
    setWork({ operation: 'Renaming', completed: 0, total: executableFileCount });
    addDebug('info', `Renaming ${executableFileCount} file${executableFileCount === 1 ? '' : 's'}`, `${executableGroups.length} ${activeMediaTab === 'movies' ? 'movie' : 'episode'}${executableGroups.length === 1 ? '' : 's'} passed preflight.`);
    try {
      const result = await window.mediaRenamer.executeRenamePlan(executableGroups);
      addDebug('success', `Renamed ${result.operation.items.length} file${result.operation.items.length === 1 ? '' : 's'}`, `Operation log: ${result.logPath}`);
      setLastRename(result);
      replaceBatchPaths(result.operation.items, 'forward');
      setRenameConfirmationOpen(false);
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      addDebug('error', 'Rename operation failed', message);
    } finally {
      setRenaming(false);
      setWork(undefined);
    }
  }

  function replaceBatchPaths(items: Array<{ sourcePath: string; targetPath: string }>, direction: 'forward' | 'backward') {
    const replacements = new Map(items.map((item) => direction === 'forward' ? [item.sourcePath, item.targetPath] : [item.targetPath, item.sourcePath]));
    const remapRecord = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).map(([key, value]) => [replacements.get(key) ?? key, value]));
    setTechnicalTags(remapRecord);
    setProbeStates(remapRecord);
    probedPaths.current = new Set([...probedPaths.current].map((item) => replacements.get(item) ?? item));
    probeRuns.current = Object.fromEntries(Object.entries(probeRuns.current).map(([key, value]) => [replacements.get(key) ?? key, value]));
    setPaths((current) => current.length
      ? current.map((item) => replacements.get(item) ?? item)
      : items.filter((item) => isVideoPath(direction === 'forward' ? item.targetPath : item.sourcePath)).map((item) => direction === 'forward' ? item.targetPath : item.sourcePath));
  }

  async function undoLastRename() {
    if (!lastRename || lastRename.operation.status !== 'completed' || !window.mediaRenamer?.undoRenameOperation || undoing || renaming) return;
    setUndoing(true);
    setError(undefined);
    setWork({ operation: 'Undoing', completed: 0, total: lastRename.operation.items.length });
    addDebug('info', `Undoing ${lastRename.operation.items.length} file operation${lastRename.operation.items.length === 1 ? '' : 's'}`, `Operation log: ${lastRename.logPath}`);
    try {
      const result = await window.mediaRenamer.undoRenameOperation(lastRename.operation.id);
      replaceBatchPaths(result.operation.items, 'backward');
      setLastRename(result);
      setUndoConfirmationOpen(false);
      addDebug('success', `Restored ${result.operation.items.length} file${result.operation.items.length === 1 ? '' : 's'}`, 'The batch now points to the original file locations.');
    } catch (reason) {
      const message = errorMessage(reason);
      setError(message);
      addDebug('error', 'Undo operation failed', message);
    } finally {
      setUndoing(false);
      setWork(undefined);
    }
  }

  function clearBatch() {
    for (const timer of Object.values(removalTimers.current)) window.clearTimeout(timer);
    removalTimers.current = {};
    for (const path of paths) probeRuns.current[path] = (probeRuns.current[path] ?? 0) + 1;
    probedPaths.current.clear();
    setPaths([]);
    searchSequence.current += 1;
    seasonSequence.current += 1;
    autoSelectResult.current = false;
    setQuery('');
    setResults([]);
    setSearching(false);
    setShow(undefined);
    setMovie(undefined);
    setEpisodes([]);
    setLoadingEpisodes(false);
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
    setRemovingPaths(new Set());
    setClearConfirmation(false);
    setConfirmAllOpen(false);
    addDebug('info', 'Cleared imported media', `${paths.length} file${paths.length === 1 ? '' : 's'} removed from the current batch. No files were changed on disk.`);
  }

  function finishRemovingFile(path: string) {
    probeRuns.current[path] = (probeRuns.current[path] ?? 0) + 1;
    probedPaths.current.delete(path);
    const withoutPath = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== path));
    setPaths((current) => current.filter((item) => item !== path));
    setTechnicalTags(withoutPath);
    setProbeStates(withoutPath);
    setMatchOverrides(withoutPath);
    setConfirmedPaths((current) => { const next = new Set(current); next.delete(path); return next; });
    if (reviewingPath === path) setReviewingPath(undefined);
    if (pinnedPreviewPath === path) setPinnedPreviewPath(undefined);
    setRemovingPaths((current) => { const next = new Set(current); next.delete(path); return next; });
    delete removalTimers.current[path];
    addDebug('info', `Removed ${filenameFromPath(path)} from the batch`, 'The source file was not changed on disk.');
  }

  function removeFileFromBatch(path: string) {
    if (removalTimers.current[path] !== undefined) return;
    setRemovingPaths((current) => new Set(current).add(path));
    removalTimers.current[path] = window.setTimeout(() => finishRemovingFile(path), 360);
  }

  function confirmSuggestedMatch(path: string) {
    const item = matchesByPath.get(path);
    if (!item?.match) return;
    setConfirmedPaths((current) => new Set(current).add(path));
    addDebug('success', `Confirmed ${item.filename} → ${episodeCode(item.match.episode)} ${item.match.episode.title}`, item.match.reasons.join('; ') || 'Accepted the suggested match.');
  }

  function confirmAllSuggestedMatches() {
    if (!confirmablePaths.length) return;
    setConfirmedPaths((current) => new Set([...current, ...confirmablePaths]));
    addDebug('success', `Confirmed ${confirmablePaths.length} suggested episode match${confirmablePaths.length === 1 ? '' : 'es'}`, 'Accepted the currently displayed suggestion for each file.');
    setConfirmAllOpen(false);
  }

  function openMatchReview(path: string) {
    const item = matchesByPath.get(path);
    setReviewingPath(path);
    setReviewSearch('');
    setReviewCandidate(item?.match);
  }

  function confirmMatchReview(candidate = reviewCandidate) {
    if (!reviewingPath || !candidate) return;
    setMatchOverrides((current) => ({ ...current, [reviewingPath]: candidate }));
    setConfirmedPaths((current) => new Set(current).add(reviewingPath));
    addDebug('success', `Confirmed ${filenameFromPath(reviewingPath)} → ${episodeCode(candidate.episode)} ${candidate.episode.title}`, candidate.reasons.join('; ') || 'Manually confirmed.');
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

  function switchMediaTab(tab: PreferenceMediaTab) {
    if (tab === activeMediaTab) return;
    searchSequence.current += 1;
    autoSelectResult.current = false;
    setActiveMediaTab(tab);
    setQuery(tab === 'movies' ? movie?.name ?? '' : show?.name ?? '');
    setResults([]);
    setSearching(false);
    setError(undefined);
    setReviewingPath(undefined);
    setPinnedPreviewPath(undefined);
  }

  const activeTitle = activeMediaTab === 'movies' ? movie : show;

  return (
    <div className={`app-shell platform-${window.mediaRenamer?.platform ?? 'web'} ${debugDocked ? `debug-docked dock-${dockPosition}` : ''} ${preferencesOpen ? 'preferences-open' : ''}`} style={{ '--debug-size': `${dockSizes[dockPosition]}px` } as CSSProperties}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Tv size={18} /></span> Media Renamer <span className="beta">ALPHA</span></div>
        <nav><button className={activeMediaTab === 'shows' ? 'nav-active' : ''} aria-pressed={activeMediaTab === 'shows'} onClick={() => switchMediaTab('shows')}><Tv size={15}/> TV</button><button className={activeMediaTab === 'movies' ? 'nav-active' : ''} aria-pressed={activeMediaTab === 'movies'} onClick={() => switchMediaTab('movies')}><Film size={15}/> Movies</button></nav>
        <div className="topbar-actions">
          <button className={`icon-button ${preferencesOpen ? 'active' : ''}`} aria-label={preferencesOpen ? 'Close preferences' : 'Open preferences'} title={preferencesOpen ? 'Close preferences' : 'Preferences'} onClick={() => { if (preferencesOpen) { setPreferencesOpen(false); setTemplateReferenceOpen(false); } else { setPreferenceMediaTab(activeMediaTab); setPreferencesOpen(true); } }}><Settings size={18}/></button>
          <button className={`icon-button ${debugDocked ? 'active' : ''}`} aria-label="Toggle docked debug console" title="Toggle debug console" onClick={() => { if (debugDocked) setDebugDocked(false); else { setDebugDocked(true); void window.mediaRenamer?.dockDebugConsole(); } }}><SquareTerminal size={18}/></button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="show-identity">
            {activeTitle?.posterUrl && <button className="show-poster-button" aria-label={`View full poster for ${activeTitle.name}`} title="View full poster" onClick={() => { setPosterCanZoom(false); setPosterZoomed(false); setPosterPreviewOpen(true); }}><img className="show-poster" src={activeTitle.posterUrl} alt=""/></button>}
            <div>
              <p className="eyebrow">ACTIVE {activeMediaTab === 'movies' ? 'MOVIE' : 'SHOW'}</p>
              {activeTitle?.logoUrl && <img className="show-logo" src={activeTitle.logoUrl} alt={`${activeTitle.name}${activeTitle.year ? ` (${activeTitle.year})` : ''}`} title={`${activeTitle.name}${activeTitle.year ? ` (${activeTitle.year})` : ''}`}/>}
              {!activeTitle?.logoUrl && <h1>{activeTitle ? <>{activeTitle.name} {activeTitle.year && <span>({activeTitle.year})</span>}</> : activeMediaTab === 'movies' ? 'Choose a movie' : 'Choose a TV show'}</h1>}
              <p>{activeMediaTab === 'movies' ? movie ? `${movie.year ?? 'Year unknown'} · TMDB movie` : 'Search TMDB to load movie metadata' : show ? `${episodes.length} episodes · ${show.seasons.length} seasons · TMDB` : 'Search TMDB to load real episode metadata'}</p>
            </div>
          </div>
          <div className="show-search">
            <div className="search"><Search size={17}/><input ref={searchInput} aria-label={activeMediaTab === 'movies' ? 'Search movies' : 'Search TV shows'} value={query} onChange={(event) => { autoSelectResult.current = false; setQuery(event.target.value); if (activeMediaTab === 'movies') { if (event.target.value !== movie?.name) setMovie(undefined); } else if (event.target.value !== show?.name) { seasonSequence.current += 1; setShow(undefined); setEpisodes([]); setLoadingEpisodes(false); } }} placeholder={activeMediaTab === 'movies' ? 'Movie name or tmdb-…' : 'Show name, tvdb-482771, or tmdb-…'} autoComplete="off"/>{searching && <LoaderCircle className="spin" size={16}/>}{query ? <button className="search-clear" aria-label={`Clear ${activeMediaTab === 'movies' ? 'movie' : 'show'} search`} title="Clear search" onClick={clearShowSearch}><X size={15}/></button> : !searching && <kbd>⌘ K</kbd>}</div>
            {results.length > 0 && <div className="search-results">
              {results.map((result) => <button key={result.id} onClick={() => void selectShow(result)}>
                {result.posterUrl ? <img src={result.posterUrl} alt=""/> : <span className="poster-placeholder">{activeMediaTab === 'movies' ? <Film size={18}/> : <Tv size={18}/>}</span>}
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
              <div><p className="eyebrow">{activeMediaTab === 'movies' ? 'MOVIE' : 'EPISODES'}</p><h2>{activeMediaTab === 'movies' ? movie ? 'Selected movie' : 'Select a movie' : show ? `${show.seasons.length} seasons` : 'Select a show'}</h2></div>
              {activeMediaTab === 'shows' && show && <span className="count">{episodes.length}</span>}
              {activeMediaTab === 'movies' && movie && <span className="count"><Film size={14}/></span>}
            </div>
            <div className="episode-list">
              {activeMediaTab === 'movies' ? movie ? <div className="movie-summary"><strong>{movie.name}</strong><span>{movie.year ?? 'Release year unknown'}</span>{movie.overview && <p>{movie.overview}</p>}<small>TMDB {movie.id}</small></div> : <div className="empty-state">Search for a movie to begin.</div> : <>{loadingEpisodes && <div className="empty-state"><LoaderCircle className="spin" size={20}/>Loading episodes…</div>}
              {!loadingEpisodes && episodes.map((episode, index) => <div key={episode.id}>
                {episodes[index - 1]?.season !== episode.season && <div className="season-divider">{seasonHeading(episode.season)}</div>}
                <div className="episode"><span>{String(episode.number).padStart(2, '0')}</span><strong title={episode.title}>{episode.title}</strong>{attachedFileCountByEpisode.has(episode.id) && <Check size={14} aria-label={`Attached to ${attachedFileCountByEpisode.get(episode.id)} imported file${attachedFileCountByEpisode.get(episode.id) === 1 ? '' : 's'}`}><title>Attached to {attachedFileCountByEpisode.get(episode.id)} imported file{attachedFileCountByEpisode.get(episode.id) === 1 ? '' : 's'}</title></Check>}</div>
              </div>)}
              {!loadingEpisodes && episodes.length === 0 && <div className="empty-state">Search for a show to begin.</div>}</>}
            </div>
          </aside>

          <section className={`match-panel panel ${fileDropActive ? 'drop-active' : ''}`} onDragEnter={enterFileDropTarget} onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} onDragLeave={leaveFileDropTarget} onDrop={dropFilesOnPanel}>
            <div className="panel-heading main-heading">
              <div><p className="eyebrow">MATCH &amp; REVIEW</p><h2>{paths.length} imported files</h2></div>
              <div className="add-actions"><button className={`secondary ${moveFiles ? 'active' : ''}`} aria-pressed={moveFiles} title={moveFiles ? (activeMediaTab === 'movies' ? movieBaseFolder : tvBaseFolder) ? `Move renamed files into ${activeMediaTab === 'movies' ? movieBaseFolder : tvBaseFolder}` : `Create the ${activeMediaTab === 'movies' ? 'movie' : 'show'} folder beside each source file` : 'Rename files in their current folders'} onClick={() => setMoveFiles((enabled) => !enabled)}><FolderTree size={15}/>{moveFiles ? 'Move files' : 'In place'}</button><button className={`secondary ${sourceOverride !== 'auto' || aiUpscaleOverride !== 'auto' ? 'active' : ''}`} aria-expanded={batchMetadataOpen} onClick={() => setBatchMetadataOpen((open) => !open)}><SlidersHorizontal size={15}/> Batch metadata{(sourceOverride !== 'auto' || aiUpscaleOverride !== 'auto') && <span className="active-indicator"/>}</button><button className="secondary" disabled={!paths.length || inspectingAny} onClick={() => setRefreshConfirmation(true)}><RefreshCw size={15}/> Refresh media</button><button className="secondary clear-batch" disabled={!paths.length} onClick={() => setClearConfirmation(true)}><Trash2 size={15}/> Clear all</button><button className="secondary" onClick={addFiles}><FolderOpen size={16}/> Add files</button><button className="secondary" onClick={addFolders}><FolderPlus size={16}/> Add folder</button></div>
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
            {paths.length > 0 && <div className={`plan-status ${preflightPlan.blockedCount || preflightError ? 'blocked' : 'ready'}`}>
              {checkingPlan ? <LoaderCircle className="spin" size={18}/> : preflightPlan.blockedCount || preflightError ? <TriangleAlert size={18}/> : <ShieldCheck size={18}/>}
              <span role="status" aria-live="polite"><strong>{checkingPlan ? 'Checking destination files…' : preflightError ? 'Could not verify rename destinations' : preflightPlan.blockedCount ? `${preflightPlan.blockedCount} file${preflightPlan.blockedCount === 1 ? '' : 's'} blocked` : 'Rename plan passed preflight'}</strong><small>{checkingPlan ? 'Duplicate names will be numbered automatically. Rename unlocks when the filesystem check finishes.' : preflightError ?? `${preflightPlan.readyCount} ready · ${companionCount} companion${companionCount === 1 ? '' : 's'} · ${preflightPlan.warningCount} warning${preflightPlan.warningCount === 1 ? '' : 's'}${preflightPlan.destinationDirectories.length ? ` · ${preflightPlan.destinationDirectories.length} destination folder${preflightPlan.destinationDirectories.length === 1 ? '' : 's'}` : ''}${preflightPlan.blockedCount ? ' · Review or ambiguous files must be resolved' : ' · No collisions detected'}`}</small></span>
              {preflightError && <button className="secondary" onClick={() => setPreflightAttempt((attempt) => attempt + 1)}>Retry</button>}
              {confirmablePaths.length > 0 && <button className="secondary confirm-suggestions" onClick={() => setConfirmAllOpen(true)}><FileCheck2 size={15}/> Confirm {confirmablePaths.length} suggestion{confirmablePaths.length === 1 ? '' : 's'}</button>}
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
                const activeFormatError = activeMediaTab === 'movies' ? movieFormatError : formatError;
                const activeFolderError = activeMediaTab === 'movies' ? movieFolderFormatError : folderFormatError;
                const output = plannedTargetName ? extension ? plannedTargetName.slice(0, -extension.length) : plannedTargetName : activeFormatError ? 'Fix the filename template' : moveFiles && activeFolderError ? `Fix the ${activeMediaTab === 'movies' ? 'movie' : 'show'} folder pattern` : 'No suggested name';
                const status = item?.status ?? 'pending';
                const confirmed = confirmedPaths.has(path);
                const detailTags = tags ? [tags.resolution, tags.source !== 'Unknown' ? tags.source : undefined, tags.videoCodec, tags.audioCodec, tags.channels, ...tags.flags, tags.group].filter(Boolean) : [];
                const planIssues = planIssuesByPath.get(path) ?? [];
                const blockingIssue = planIssues.find((issue) => issue.severity === 'error');
                const fullProposedName = plannedTargetName ?? (item ? output : `Waiting for ${activeMediaTab === 'movies' ? 'movie' : 'show'} metadata`);
                const previewPinned = pinnedPreviewPath === path;
                const removing = removingPaths.has(path);
                return <div className={`match-row-slot ${removing ? 'removing' : ''}`} key={path}><div className="match-row-collapse"><article className={`match-row ${previewPinned ? 'preview-pinned' : ''} ${removing ? 'removing' : ''}`}>
                  <div className={`status-dot ${inspecting ? 'inspecting' : confirmed ? 'confirmed' : status}`}>{inspecting ? <LoaderCircle className="spin"/> : confirmed || status === 'confident' ? <Check/> : status === 'review' ? '!' : status === 'unmatched' ? <X/> : '…'}</div>
                  <div className="file-content" tabIndex={fileViewMode === 'detailed' ? undefined : 0} role={fileViewMode === 'detailed' ? undefined : 'button'} aria-expanded={fileViewMode === 'detailed' ? undefined : previewPinned} aria-label={fileViewMode === 'detailed' ? undefined : `Show complete filenames for ${filename}`} onClick={() => { if (fileViewMode !== 'detailed') setPinnedPreviewPath((current) => current === path ? undefined : path); }} onKeyDown={(event) => { if (fileViewMode !== 'detailed' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setPinnedPreviewPath((current) => current === path ? undefined : path); } }}>
                    <div className="file-pair"><div className="original"><FileVideo size={15}/><span>{filename}</span></div><div className="arrow"><ChevronRight size={15}/></div><div className="proposed">{item ? output : `Waiting for ${activeMediaTab === 'movies' ? 'movie' : 'show'} metadata`}<span>{item?.match ? extension : ''}</span>{inspecting && <em>Inspecting video &amp; audio…</em>}{probeState === 'error' && <em className="probe-error">Media details unavailable</em>}{blockingIssue && <em className="plan-error">{blockingIssue.message}</em>}</div></div>
                    {fileViewMode === 'detailed' && <div className="file-details">
                      {planIssues.length ? <span className={`match-reasons ${blockingIssue ? 'has-error' : ''}`}>{planIssues.map((issue) => issue.message).join(' ')}</span> : item?.match?.reasons.length ? <span className="match-reasons">Matched by {item.match.reasons.join(' + ')}</span> : <span className="match-reasons">No match evidence</span>}
                      <span className="detail-tags">{detailTags.length ? detailTags.map((tag, index) => <small key={`${tag}-${index}`}>{tag}</small>) : <small>No release metadata</small>}</span>
                    </div>}
                    {plannedCompanions.length > 0 && (fileViewMode === 'compact' ? <div className="companion-summary">{plannedCompanions.length} companion file{plannedCompanions.length === 1 ? '' : 's'}</div> : <div className="companion-files">
                      {plannedCompanions.map((companion) => <div key={companion.sourcePath}>
                        {companion.kind === 'subtitle' ? <Captions size={12}/> : companion.kind === 'artwork' ? <FileImage size={12}/> : <FileText size={12}/>}
                        <span title={companion.sourceName}>{companion.sourceName}</span><ChevronRight size={11}/><strong title={companion.targetName}>{companion.targetName ?? `Waiting for ${activeMediaTab === 'movies' ? 'movie' : 'episode'} match`}</strong>
                      </div>)}
                    </div>)}
                    {fileViewMode !== 'detailed' && <div className="filename-preview" onClick={(event) => { event.stopPropagation(); if (!previewPinned) setPinnedPreviewPath(path); }}>
                      <div><span>Original</span><code>{filename}</code></div>
                      <div><span>Proposed</span><code>{fullProposedName}</code></div>
                      {previewPinned && <button aria-label="Close filename preview" title="Close preview" onClick={(event) => { event.stopPropagation(); setPinnedPreviewPath(undefined); }}><X size={13}/></button>}
                    </div>}
                  </div>
                  <div className="row-trailing"><div className="score"><strong>{item ? `${Math.round((item.match?.score ?? 0) * 100)}%` : '—'}</strong><small>{inspecting ? 'inspecting' : activeMediaTab === 'movies' && item ? 'selected' : confirmed ? 'confirmed' : status}</small></div>{activeMediaTab === 'shows' && item?.match && !confirmed && status !== 'confident' ? <button className="row-confirm" aria-label={`Confirm suggested episode match for ${filename}`} title="Confirm suggested match" onClick={() => confirmSuggestedMatch(path)}><Check size={14}/></button> : <span className="row-action-placeholder"/>}{activeMediaTab === 'shows' ? <button className={`row-review ${!confirmed && (status === 'review' || status === 'unmatched') ? 'required' : ''}`} aria-label={`Review episode match for ${filename}`} title="Review episode match" disabled={!item} onClick={() => openMatchReview(path)}><ListChecks size={14}/></button> : <span className="row-action-placeholder"/>}<div className="row-extras"><button className="row-refresh" aria-label={`Refresh media information for ${filename}`} title="Refresh media information" disabled={inspecting} onClick={() => void inspectMedia([path])}><RefreshCw className={inspecting ? 'spin' : ''} size={14}/></button><button className="row-remove" aria-label={`Remove ${filename} from batch`} title="Remove from batch" disabled={removing} onClick={() => removeFileFromBatch(path)}><Trash2 size={14}/></button></div></div>
                </article></div></div>;
              })}
            </div>}
            {paths.length === 0 && <button className="dropzone dropzone-empty" onClick={addFiles}><FolderOpen size={30}/><span>Drop files or folders anywhere in this panel</span><small>or click to choose video files</small></button>}
            {paths.length > 0 && <div className="drop-target-overlay" aria-hidden="true"><FolderPlus size={30}/><strong>Add files or folders</strong><small>Drop anywhere in this panel</small></div>}
          </section>
        </section>
      </main>

      <footer><div><span className="legend confident"></span>{preflightPlan.readyCount} ready <span className="legend review"></span>{preflightError ? 'preflight failed' : `${preflightPlan.blockedCount} blocked`} <span className="tmdb-attribution">This product uses the TMDB API but is not endorsed or certified by TMDB.</span></div><div>{lastRename?.operation.status === 'completed' && <button className="secondary" disabled={renaming || undoing} onClick={() => setUndoConfirmationOpen(true)}>{undoing ? <LoaderCircle className="spin" size={15}/> : <RotateCcw size={15}/>} Undo last rename</button>}<button className="secondary" disabled={!paths.length || checkingPlan || Boolean(preflightError) || renaming || undoing} onClick={() => void exportPlan()}>Export plan</button><button className="primary" title={checkingPlan ? 'Waiting for the filesystem collision check' : preflightError ? 'Retry the failed preflight check before renaming' : undefined} disabled={!executableGroups.length || preflightPlan.blockedCount > 0 || checkingPlan || Boolean(preflightError) || renaming || undoing} onClick={() => setRenameConfirmationOpen(true)}>{renaming ? <LoaderCircle className="spin" size={16}/> : null} Rename {preflightPlan.readyCount} files <ChevronRight size={16}/></button></div></footer>

      {posterPreviewOpen && activeTitle?.posterUrl && <div className="poster-preview-layer">
        <button className="poster-preview-backdrop" aria-label="Close poster preview" onClick={() => { setPosterPreviewOpen(false); setPosterZoomed(false); }}/>
        <section ref={posterPreviewDialog} className={`poster-preview-dialog ${posterZoomed && posterCanZoom ? 'zoomed' : ''}`} role="dialog" aria-modal="true" aria-label={`${activeTitle.name}${activeTitle.year ? ` (${activeTitle.year})` : ''} poster`}>
          <button className="poster-preview-image" disabled={!posterCanZoom} aria-label={posterCanZoom ? posterZoomed ? 'Fit poster to window' : 'View poster at full size' : undefined} aria-pressed={posterCanZoom ? posterZoomed : undefined} title={posterCanZoom ? posterZoomed ? 'Fit to window' : 'View at 100%' : undefined} onClick={() => { if (posterCanZoom) setPosterZoomed((zoomed) => !zoomed); }}><img ref={posterPreviewImage} src={fullSizeArtworkUrl(activeTitle.posterUrl)} alt={`${activeTitle.name}${activeTitle.year ? ` (${activeTitle.year})` : ''} poster`} onLoad={() => { updatePosterZoomAvailability(); if (posterZoomed) centerPosterPreview(); }}/></button>
        </section>
        <button className="poster-preview-close" aria-label="Close poster preview" title="Close" autoFocus onClick={() => { setPosterPreviewOpen(false); setPosterZoomed(false); }}><X size={20}/></button>
      </div>}

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

      {confirmAllOpen && <div className="confirmation-layer" role="presentation">
        <button className="confirmation-backdrop" aria-label="Cancel confirming suggested matches" onClick={() => setConfirmAllOpen(false)}/>
        <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-all-title" aria-describedby="confirm-all-description">
          <span className="confirmation-icon"><FileCheck2 size={20}/></span>
          <h2 id="confirm-all-title">Confirm {confirmablePaths.length} suggested match{confirmablePaths.length === 1 ? '' : 'es'}?</h2>
          <p id="confirm-all-description">This accepts the episode currently shown beside each review file. You can still open an individual review first if any suggestion looks wrong.</p>
          <div><button className="secondary" autoFocus onClick={() => setConfirmAllOpen(false)}>Cancel</button><button className="primary" onClick={confirmAllSuggestedMatches}><Check size={15}/> Confirm all</button></div>
        </section>
      </div>}

      {renameConfirmationOpen && <div className="confirmation-layer" role="presentation">
        <button className="confirmation-backdrop" aria-label="Cancel rename" disabled={renaming} onClick={() => setRenameConfirmationOpen(false)}/>
        <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="rename-title" aria-describedby="rename-description">
          <span className="confirmation-icon"><FileCheck2 size={20}/></span>
          <h2 id="rename-title">Rename {executableGroups.length} {activeMediaTab === 'movies' ? 'movie' : 'episode'}{executableGroups.length === 1 ? '' : 's'}?</h2>
          <p id="rename-description">This will rename or move {executableFileCount} file{executableFileCount === 1 ? '' : 's'}, including companion files. Existing destinations are automatically given an increment such as <code>(2)</code>, and the complete operation is logged for undo.</p>
          {renaming && work && <progress className="rename-progress" value={work.completed} max={work.total}/>}
          <div><button className="secondary" autoFocus disabled={renaming} onClick={() => setRenameConfirmationOpen(false)}>Cancel</button><button className="primary" disabled={renaming} onClick={() => void executeRenames()}>{renaming ? <LoaderCircle className="spin" size={15}/> : <FileCheck2 size={15}/>} {renaming ? `Renaming ${work?.completed ?? 0}/${work?.total ?? executableFileCount}` : 'Rename files'}</button></div>
        </section>
      </div>}

      {undoConfirmationOpen && lastRename?.operation.status === 'completed' && <div className="confirmation-layer" role="presentation">
        <button className="confirmation-backdrop" aria-label="Cancel undo" onClick={() => setUndoConfirmationOpen(false)}/>
        <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="undo-title" aria-describedby="undo-description">
          <span className="confirmation-icon"><RotateCcw size={20}/></span>
          <h2 id="undo-title">Undo the last rename?</h2>
          <p id="undo-description">This will safely move {lastRename.operation.items.length} file{lastRename.operation.items.length === 1 ? '' : 's'} back to their original locations. Undo stops if an original path is now occupied.</p>
          <div><button className="secondary" disabled={undoing} onClick={() => setUndoConfirmationOpen(false)}>Cancel</button><button className="primary" disabled={undoing} onClick={() => void undoLastRename()}>{undoing && <LoaderCircle className="spin" size={15}/>} Undo rename</button></div>
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
              return <button key={candidate.episode.id} className={selected ? 'selected' : ''} title="Double-click to confirm this episode" onClick={() => setReviewCandidate(candidate)} onDoubleClick={() => confirmMatchReview(candidate)}>
                <span className="candidate-code">{episodeCode(candidate.episode)}</span>
                <span><strong>{candidate.episode.title}</strong><small>{manual ? 'Manual selection' : candidate.reasons.join(' · ') || 'No matching evidence'}</small></span>
                <span className="candidate-score">{manual ? 'Manual' : `${Math.round(candidate.score * 100)}%`}</span>
                {selected && <Check size={15}/>}
              </button>;
            })}
            {reviewCandidates.length === 0 && <div className="review-empty">No episodes match that search.</div>}
          </div>
          <div className="review-footer"><span><FileCheck2 size={15}/> Double-click an episode to confirm it immediately.</span><button className="primary" disabled={!reviewCandidate} onClick={() => confirmMatchReview()}>Confirm match</button></div>
        </aside>
      </div>}

      {preferencesOpen && <div className="preferences-layer">
        <button className="preferences-backdrop" aria-label="Close preferences" onClick={() => { setPreferencesOpen(false); setTemplateReferenceOpen(false); }}/>
        {templateReferenceOpen && <TemplateReferencePanel tab={preferenceMediaTab} onClose={() => setTemplateReferenceOpen(false)}/>}
        <aside className="preferences-panel" aria-label="Preferences">
          <div className="preferences-heading"><div><p className="eyebrow">SETTINGS</p><h2>Preferences</h2></div><button className="icon-button" aria-label="Close preferences" onClick={() => { setPreferencesOpen(false); setTemplateReferenceOpen(false); }}><X size={18}/></button></div>
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
          <div className="preference-media-tabs" role="tablist" aria-label="Media settings">
            <button role="tab" aria-selected={preferenceMediaTab === 'shows'} className={preferenceMediaTab === 'shows' ? 'active' : ''} onClick={() => setPreferenceMediaTab('shows')}><Tv size={15}/> Shows</button>
            <button role="tab" aria-selected={preferenceMediaTab === 'movies'} className={preferenceMediaTab === 'movies' ? 'active' : ''} onClick={() => setPreferenceMediaTab('movies')}><Film size={15}/> Movies</button>
          </div>
          {preferenceMediaTab === 'shows' ? <div className="preference-media-panel" role="tabpanel" aria-label="Shows settings">
            <section className="preference-section"><h3>Episode matching</h3><label className="preference-toggle"><span><Sparkles size={17}/><span><strong>Match episode names</strong><small>Best effort when numbering and titles disagree</small></span></span><input type="checkbox" checked={titleMatching} onChange={(event) => { setTitleMatching(event.target.checked); addDebug('info', `Episode-title matching ${event.target.checked ? 'enabled' : 'disabled'}`); }}/></label></section>
            <section className={`preference-section destination-settings ${folderFormatError ? 'invalid' : ''}`}><h3>Show destination</h3><p>Optionally move renamed episodes into a show folder beneath a dedicated TV library.</p>
              <div className="destination-row"><span><strong>TV base folder</strong><small>{tvBaseFolder || 'Create the show folder beside each source'}</small></span><span className="destination-actions"><button className="secondary" onClick={() => void chooseBaseFolder('TV')}><FolderTree size={14}/>{tvBaseFolder ? 'Change' : 'Choose'}</button>{tvBaseFolder && <button className="icon-button" aria-label="Clear TV base folder" title="Create the show folder beside each source" onClick={() => setTvBaseFolder('')}><X size={14}/></button>}</span></div>
              <label className="folder-template-field"><span><strong>Show folder pattern</strong><small>Use seasonFolder for “Season 5” and “Specials” automatically.</small></span><input value={showFolderTemplate} onChange={(event) => setShowFolderTemplate(event.target.value)} spellCheck={false}/></label>
              {!folderFormatError && <small className="format-help"><code>{'{{show.name}}'}</code><code>{'{{show.year}}'}</code><code>{'{{show.tvdbId}}'}</code><code>{'{{season}}'}</code><code>{'{{seasonPadded}}'}</code><code>{'{{seasonFolder}}'}</code><code>{'{{isSpecial}}'}</code><button className={`reference-link ${templateReferenceOpen ? 'active' : ''}`} aria-expanded={templateReferenceOpen} onClick={() => setTemplateReferenceOpen((open) => !open)}>Reference</button></small>}
              {folderFormatError ? <small className="format-error">{folderFormatError}</small> : <><div className="format-preview"><span>Season</span><strong>{joinPath(tvBaseFolder || 'Source folder', formatShowFolder(showFolderTemplate, 'Star Trek: The Next Generation', 1987, '71470', 1))}</strong></div><div className="format-preview"><span>Specials</span><strong>{joinPath(tvBaseFolder || 'Source folder', formatShowFolder(showFolderTemplate, 'Star Trek: The Next Generation', 1987, '71470', 0))}</strong></div></>}
            </section>
            <section className={`preference-section format-editor ${formatError ? 'invalid' : ''}`}>
              <div className="format-heading"><span><h3>Episode filename template</h3><p>Lay it out like a script. Runs of whitespace and indentation become one filename space.</p></span><button onClick={() => setEpisodeTemplate(DEFAULT_EPISODE_TEMPLATE)} disabled={episodeTemplate === DEFAULT_EPISODE_TEMPLATE}>Reset</button></div>
              <TemplateEditor value={episodeTemplate} onChange={setEpisodeTemplate}/>
              {formatError ? <small className="format-error">{formatError}</small> : <small className="format-help"><code>{'{{show.name}}'}</code> <code>{'{{show.tvdbId}}'}</code> <code>{'{{episode.range}}'}</code> <code>{'{{#episodes}}…{{/episodes}}'}</code> <code>{'{{technical}}'}</code> <code>{'{{release.audioCodec}}'}</code><button className={`reference-link ${templateReferenceOpen ? 'active' : ''}`} aria-expanded={templateReferenceOpen} onClick={() => setTemplateReferenceOpen((open) => !open)}>Reference</button></small>}
              {singleEpisodeFormatExample && <div className="format-preview"><span>Single</span><strong>{singleEpisodeFormatExample}.mkv</strong></div>}
              {multiEpisodeFormatExample && <div className="format-preview"><span>Merged</span><strong>{multiEpisodeFormatExample}.mkv</strong></div>}
            </section>
          </div> : <div className="preference-media-panel" role="tabpanel" aria-label="Movies settings">
            <section className={`preference-section destination-settings ${movieFolderFormatError ? 'invalid' : ''}`}><h3>Movie destination</h3><p>Configure the separate library destination that the movie workflow will use.</p>
              <div className="destination-row"><span><strong>Movie base folder</strong><small>{movieBaseFolder || 'Create the movie folder beside its source'}</small></span><span className="destination-actions"><button className="secondary" onClick={() => void chooseBaseFolder('Movie')}><FolderTree size={14}/>{movieBaseFolder ? 'Change' : 'Choose'}</button>{movieBaseFolder && <button className="icon-button" aria-label="Clear movie base folder" title="Create the movie folder beside its source" onClick={() => setMovieBaseFolder('')}><X size={14}/></button>}</span></div>
              <label className="folder-template-field"><span><strong>Movie folder pattern</strong><small>Supports movie.name, movie.year, movie.tmdbId, and nested folders.</small></span><input value={movieFolderTemplate} onChange={(event) => setMovieFolderTemplate(event.target.value)} spellCheck={false}/></label>
              {!movieFolderFormatError && <small className="format-help"><code>{'{{movie.name}}'}</code><code>{'{{movie.year}}'}</code><code>{'{{movie.tmdbId}}'}</code><button className={`reference-link ${templateReferenceOpen ? 'active' : ''}`} aria-expanded={templateReferenceOpen} onClick={() => setTemplateReferenceOpen((open) => !open)}>Reference</button></small>}
              {movieFolderFormatError ? <small className="format-error">{movieFolderFormatError}</small> : <div className="format-preview"><span>Output</span><strong>{joinPath(movieBaseFolder || 'Source folder', formatMovieFolder(movieFolderTemplate, 'Blade Runner: 2049', 2017, '335984'))}</strong></div>}
            </section>
            <section className={`preference-section format-editor ${movieFormatError ? 'invalid' : ''}`}>
              <div className="format-heading"><span><h3>Movie filename template</h3><p>Controls the filename produced by the movie workflow.</p></span><button onClick={() => setMovieTemplate(DEFAULT_MOVIE_TEMPLATE)} disabled={movieTemplate === DEFAULT_MOVIE_TEMPLATE}>Reset</button></div>
              <TemplateEditor value={movieTemplate} onChange={setMovieTemplate}/>
              {movieFormatError ? <small className="format-error">{movieFormatError}</small> : <small className="format-help"><code>{'{{movie.name}}'}</code> <code>{'{{movie.year}}'}</code> <code>{'{{movie.tmdbId}}'}</code> <code>{'{{technical}}'}</code> <code>{'{{release.audioCodec}}'}</code><button className={`reference-link ${templateReferenceOpen ? 'active' : ''}`} aria-expanded={templateReferenceOpen} onClick={() => setTemplateReferenceOpen((open) => !open)}>Reference</button></small>}
              {movieFormatExample && <div className="format-preview"><span>Output</span><strong>{movieFormatExample}.mkv</strong></div>}
            </section>
          </div>}
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
