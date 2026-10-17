import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type UIEvent } from 'react';
import { AlertCircle, BellRing, Captions, Check, ChevronRight, FileCheck2, FileImage, FilePenLine, FileText, FileVideo, Film, FolderOpen, FolderPlus, FolderTree, ListChecks, LoaderCircle, Monitor, Moon, RefreshCw, RotateCcw, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Square, SquareTerminal, Sun, Trash2, TriangleAlert, Tv, X } from 'lucide-react';
import { prepareCompletionChime } from './completionChime';
import { DEFAULT_EPISODE_TEMPLATE, DEFAULT_MOVIE_FOLDER_TEMPLATE, DEFAULT_MOVIE_TEMPLATE, DEFAULT_SHOW_FOLDER_TEMPLATE, formatEpisode, formatEpisodeFilename, formatMovie, formatMovieFilename, formatMovieFolder, formatShowFolder, movieFolderTemplateError, movieTemplateError, PREVIOUS_DEFAULT_EPISODE_TEMPLATE, PREVIOUS_DEFAULT_MOVIE_FOLDER_TEMPLATE, PREVIOUS_DEFAULT_MOVIE_TEMPLATE, PREVIOUS_EDITION_DEFAULT_MOVIE_TEMPLATE, PREVIOUS_TVDB_DEFAULT_EPISODE_TEMPLATE, showFolderTemplateError, templateError } from './core/formatter';
import { createRenamePlan, destinationDirectoryForSource, unchangedRenameItemPaths } from './core/renamePlan';
import { applyReleaseOverrides, parseMovieEdition, parseReleaseTags } from './core/releaseTags';
import { parseReleaseAliasText } from './core/releaseAliases';
import { formatSeasonLabel } from './core/seasonLabel';
import { inferShowQuery } from './core/showInference';
import { inferMovieQuery, inferMovieQueryCandidates } from './core/movieInference';
import { classifyMediaBatch, classifyMediaFile } from './core/mediaClassification';
import { optionalMetadataNumber, validateMediaMetadata, type MediaMetadataOverride } from './core/metadataEditing';
import { movieMatchConfirmationState, tvMatchConfirmationState } from './core/matchConfirmation';
import { chooseMovieMatch, confirmSuggestedMovie, manuallySelectMovie, type MovieFileMatch } from './core/movieMatching';
import { applySavedMatchDecision, saveMatchDecision, showDecisionId } from './core/savedMatchDecisions';
import type { CompanionScan, Episode, FileMatch, MatchCandidate, MediaTechnicalTags, MovieSearchResult, ProviderStatus, RenamePlanIssue, SavedMatchDecision, ShowDetails, ShowMetadataAgent, ShowSearchResult, Source } from './core/types';
import { DebugPanel, type DebugEntry, type DockPosition } from './DebugConsole';
import { SeasonalEffects } from './SeasonalEffects';
import { availablePalettes } from './seasonalThemes';
import { useTheme, type ThemePalette } from './theme';
import { LANGUAGE_OPTIONS, useI18n, type LanguagePreference } from './i18n';

type WorkProgress = { operation: 'Scanning' | 'Importing' | 'Renaming' | 'Undoing'; completed: number; total: number };
type RenameOperationRecord = { operation: { id: string; status: 'completed' | 'stopped' | 'undone'; items: Array<{ sourcePath: string; targetPath: string }>; removedSourceJunkFiles?: string[]; removedSourceDirectories?: string[]; sourceDirectoryCleanupWarnings?: string[]; externalLogPath?: string; externalLogWarning?: string }; logPath: string };
type DebugLevel = 'info' | 'success' | 'warning' | 'error';
type TemplateField = { name: string; description: string; example: string };
type FileViewMode = 'detailed' | 'summary' | 'compact';
type PreferenceMediaTab = 'shows' | 'movies';
type RenameReport = { result: RenameOperationRecord; moved: boolean };

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
    { name: 'release.webOrigin', description: 'Full web service name', example: 'Netflix' },
    { name: 'release.webOriginShort', description: 'Web service shorthand', example: 'NF' },
    { name: 'release.flags', description: 'Detected flags', example: 'AI Upscale' },
  ] },
];
const MOVIE_TEMPLATE_FIELDS: Array<{ label: string; fields: TemplateField[] }> = [
  { label: 'Movie', fields: [
    { name: 'movie.name', description: 'Movie title', example: 'Blade Runner: 2049' },
    { name: 'movie.year', description: 'Release year, when known', example: '2017' },
    { name: 'movie.tmdbId', description: 'Canonical TMDB movie ID', example: '335984' },
    { name: 'release.edition', description: 'Detected Plex edition name', example: "Director's Cut" },
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
  { name: 'movie.edition', description: 'Detected Plex edition name', example: "Director's Cut" },
];

const SOURCE_OPTIONS: Source[] = ['DVD', 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'DVDRip', 'TVRip'];

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
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

function candidateEpisodes(candidate: MatchCandidate): Episode[] {
  return candidate.episodes?.length ? candidate.episodes : [candidate.episode];
}

function candidateKey(candidate: MatchCandidate): string {
  return candidateEpisodes(candidate).map((episode) => episode.id).join('|');
}

function candidateLabel(candidate: MatchCandidate): string {
  const episodes = candidateEpisodes(candidate);
  const first = episodes[0];
  return `${episodeCode(first)}${episodes.slice(1).map((episode) => `-${episode.season === first.season ? `E${String(episode.number).padStart(2, '0')}` : episodeCode(episode)}`).join('')}`;
}

function candidateTitle(candidate: MatchCandidate): string {
  return candidateEpisodes(candidate).map((episode) => episode.title).join(', ');
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

function SmoothProgress({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const boundedMax = Math.max(1, max);
  const boundedValue = Math.max(0, Math.min(value, boundedMax));
  return <div className={`smooth-progress ${className}`.trim()} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
    <span style={{ width: `${(boundedValue / boundedMax) * 100}%` }}/>
  </div>;
}

export default function App() {
  const { preference, palette, setPreference, setPalette } = useTheme();
  const { language, preference: languagePreference, setPreference: setLanguagePreference, t } = useI18n();
  const showMetadataAgent: ShowMetadataAgent = 'tvdb-aired';
  const [paths, setPaths] = useState<string[]>([]);
  const [titleMatching, setTitleMatching] = useState(true);
  const [matchConfidenceThreshold, setMatchConfidenceThreshold] = useState(() => {
    const saved = Number(localStorage.getItem('media-renamer-match-confidence-threshold'));
    return Number.isFinite(saved) && saved >= 50 && saved <= 100 ? Math.round(saved) : 80;
  });
  const [sourceOverride, setSourceOverride] = useState<Source | 'auto'>('auto');
  const [releaseAliasText, setReleaseAliasText] = useState('');
  const [savedMatchDecisions, setSavedMatchDecisions] = useState<SavedMatchDecision[]>([]);
  const [aiUpscaleOverride, setAiUpscaleOverride] = useState<'auto' | 'on' | 'off'>('auto');
  const [moveFiles, setMoveFiles] = useState(true);
  const [removeEmptySourceParents, setRemoveEmptySourceParents] = useState(() => localStorage.getItem('media-renamer-remove-empty-source-parents') === 'true');
  const [autoClearCompletedBatch, setAutoClearCompletedBatch] = useState(false);
  const [completionChime, setCompletionChime] = useState(false);
  const [completionReport, setCompletionReport] = useState(true);
  const [clearSourceJunk, setClearSourceJunk] = useState(false);
  const [createExternalRenameLog, setCreateExternalRenameLog] = useState(false);
  const [renameLogFolder, setRenameLogFolder] = useState('');
  const [batchRenameCompleted, setBatchRenameCompleted] = useState(false);
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
  const [confirmAllResult, setConfirmAllResult] = useState<{ confirmed: number; remaining: Array<{ path: string; reason: string }> }>();
  const [renameConfirmationOpen, setRenameConfirmationOpen] = useState(false);
  const [undoConfirmationOpen, setUndoConfirmationOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [lastRename, setLastRename] = useState<RenameOperationRecord>();
  const [renameReport, setRenameReport] = useState<RenameReport>();
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>(() => {
    const saved = localStorage.getItem('media-renamer-file-view-mode');
    return saved === 'detailed' || saved === 'compact' ? saved : 'summary';
  });
  const [tvBaseFolder, setTvBaseFolder] = useState(() => localStorage.getItem('media-renamer-tv-base-folder') ?? '');
  const [showFolderTemplate, setShowFolderTemplate] = useState(() => localStorage.getItem('media-renamer-show-folder-template') ?? DEFAULT_SHOW_FOLDER_TEMPLATE);
  const [movieBaseFolder, setMovieBaseFolder] = useState(() => localStorage.getItem('media-renamer-movie-base-folder') ?? '');
  const [movieFolderTemplate, setMovieFolderTemplate] = useState(() => {
    const saved = localStorage.getItem('media-renamer-movie-folder-template');
    return !saved || saved === PREVIOUS_DEFAULT_MOVIE_FOLDER_TEMPLATE ? DEFAULT_MOVIE_FOLDER_TEMPLATE : saved;
  });
  const [movieTemplate, setMovieTemplate] = useState(() => {
    const saved = localStorage.getItem('media-renamer-movie-template');
    return !saved || saved === PREVIOUS_DEFAULT_MOVIE_TEMPLATE || saved === PREVIOUS_EDITION_DEFAULT_MOVIE_TEMPLATE ? DEFAULT_MOVIE_TEMPLATE : saved;
  });
  const [episodeTemplate, setEpisodeTemplate] = useState(() => {
    const saved = localStorage.getItem('media-renamer-episode-template');
    return !saved || saved === PREVIOUS_DEFAULT_EPISODE_TEMPLATE || saved === PREVIOUS_TVDB_DEFAULT_EPISODE_TEMPLATE ? DEFAULT_EPISODE_TEMPLATE : saved;
  });
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [provider, setProvider] = useState<ProviderStatus>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ShowSearchResult[]>([]);
  const [activeSearchResult, setActiveSearchResult] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [show, setShow] = useState<ShowDetails>();
  const [movieMatches, setMovieMatches] = useState<Record<string, MovieFileMatch>>({});
  const [movieReviewPath, setMovieReviewPath] = useState<string>();
  const [movieReviewQuery, setMovieReviewQuery] = useState('');
  const [movieReviewResults, setMovieReviewResults] = useState<MovieSearchResult[]>([]);
  const [movieReviewSelection, setMovieReviewSelection] = useState<string>();
  const [movieReviewSearching, setMovieReviewSearching] = useState(false);
  const [movieReviewLoading, setMovieReviewLoading] = useState(false);
  const [movieReviewError, setMovieReviewError] = useState<string>();
  const [metadataOverrides, setMetadataOverrides] = useState<Record<string, MediaMetadataOverride>>({});
  const [editingMetadataPath, setEditingMetadataPath] = useState<string>();
  const [metadataDraft, setMetadataDraft] = useState<MediaMetadataOverride>();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [matchOverrides, setMatchOverrides] = useState<Record<string, MatchCandidate>>({});
  const [confirmedPaths, setConfirmedPaths] = useState<Set<string>>(() => new Set());
  const [heldConfirmationPaths, setHeldConfirmationPaths] = useState<Set<string>>(() => new Set());
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
  const [renameStartedAt, setRenameStartedAt] = useState<number>();
  const [renameClock, setRenameClock] = useState(0);
  const [renameControl, setRenameControl] = useState<'stop' | 'undo'>();
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
  const movieBatchSequence = useRef(0);
  const movieReviewSequence = useRef(0);
  const autoSelectResult = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchResultButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const posterPreviewDialog = useRef<HTMLElement>(null);
  const posterPreviewImage = useRef<HTMLImageElement>(null);
  const probedPaths = useRef(new Set<string>());
  const probeRuns = useRef<Record<string, number>>({});
  const reportedSavedDecisionConflicts = useRef(new Set<string>());
  const matchRowElements = useRef(new Map<string, HTMLElement>());
  const removalTimers = useRef<Record<string, number>>({});
  const fileDropDepth = useRef(0);

  useEffect(() => {
    if (activeSearchResult < 0) return;
    searchResultButtons.current[activeSearchResult]?.scrollIntoView({ block: 'nearest' });
  }, [activeSearchResult]);

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
          const summary = [detected.resolution, detected.videoCodec, detected.audioCodec, detected.channels, detected.durationSeconds ? formatDuration(detected.durationSeconds * 1000) : undefined].filter(Boolean).join(' · ');
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
  const showMatchDecisionId = show ? showDecisionId(show) : undefined;
  const savedDecisionResults = useMemo<Array<{ match: FileMatch; conflict?: string }>>(() => showMatchDecisionId
    ? matches.map((item) => applySavedMatchDecision(item, episodes, savedMatchDecisions, showMatchDecisionId))
    : matches.map((match) => ({ match })), [episodes, matches, savedMatchDecisions, showMatchDecisionId]);
  const matchesByPath = useMemo(() => new Map(savedDecisionResults.map(({ match: item }) => [item.path, matchOverrides[item.path] ? { ...item, match: matchOverrides[item.path], status: 'confident' as const } : item])), [matchOverrides, savedDecisionResults]);
  useEffect(() => {
    for (const result of savedDecisionResults) {
      if (!result.conflict) continue;
      const key = `${showMatchDecisionId}:${result.match.path}:${result.conflict}`;
      if (reportedSavedDecisionConflicts.current.has(key)) continue;
      reportedSavedDecisionConflicts.current.add(key);
      addDebug('warning', `Saved match needs review for ${result.match.filename}`, result.conflict);
    }
  }, [addDebug, savedDecisionResults, showMatchDecisionId]);
  const attachedFileCountByEpisode = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of matchesByPath.values()) {
      if (!item.match) continue;
      for (const episode of candidateEpisodes(item.match)) counts.set(episode.id, (counts.get(episode.id) ?? 0) + 1);
    }
    return counts;
  }, [matchesByPath]);
  const confirmablePaths = useMemo(() => paths.filter((path) => {
    if (activeMediaTab === 'movies') {
      return movieMatchConfirmationState(movieMatches[path], classifyMediaFile(path) === 'shows').kind === 'suggestion';
    }
    return tvMatchConfirmationState(matchesByPath.get(path), confirmedPaths.has(path)).kind === 'suggestion';
  }), [activeMediaTab, confirmedPaths, matchesByPath, movieMatches, paths]);
  const confirmationBlockers = useMemo(() => paths.flatMap((path) => {
    const state = activeMediaTab === 'movies'
      ? movieMatchConfirmationState(movieMatches[path], classifyMediaFile(path) === 'shows')
      : tvMatchConfirmationState(matchesByPath.get(path), confirmedPaths.has(path));
    return state.kind === 'blocked' ? [{ path, reason: state.reason ?? 'Manual review is required.' }] : [];
  }), [activeMediaTab, confirmedPaths, matchesByPath, movieMatches, paths]);
  const confirmationSuggestions = useMemo(() => confirmablePaths.flatMap((path) => {
    if (activeMediaTab === 'movies') {
      const movie = movieMatches[path]?.movie;
      return movie ? [{ path, label: `${movie.name}${movie.year ? ` (${movie.year})` : ''}` }] : [];
    }
    const candidate = matchesByPath.get(path)?.match;
    return candidate ? [{ path, label: `${candidateLabel(candidate)} — ${candidateTitle(candidate)}` }] : [];
  }), [activeMediaTab, confirmablePaths, matchesByPath, movieMatches]);
  const confirmationActionCount = confirmationSuggestions.length + confirmationBlockers.length;
  const reviewingItem = reviewingPath ? matchesByPath.get(reviewingPath) : undefined;
  const reviewingAutomaticItem = reviewingPath ? automaticMatchesByPath.get(reviewingPath) : undefined;
  const suggestedCandidates = useMemo(() => {
    if (!reviewingItem) return [];
    const candidates = [reviewingItem.match, reviewingAutomaticItem?.match, ...reviewingItem.alternatives].filter((candidate): candidate is MatchCandidate => Boolean(candidate));
    return [...new Map(candidates.map((candidate) => [candidateKey(candidate), candidate])).values()];
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
  const parsedReleaseAliases = useMemo(() => parseReleaseAliasText(releaseAliasText), [releaseAliasText]);
  const releaseAliases = useMemo(() => parsedReleaseAliases.errors.length ? [] : parsedReleaseAliases.aliases, [parsedReleaseAliases]);
  const deferredMoviePaths = useMemo(() => new Set(paths.filter((path) => classifyMediaFile(path) === 'shows')), [paths]);
  const movieMatchCounts = useMemo(() => ({
    ready: paths.filter((path) => !deferredMoviePaths.has(path) && movieMatches[path]?.status === 'confident').length,
    review: paths.filter((path) => !deferredMoviePaths.has(path) && movieMatches[path]?.status === 'review').length,
    unmatched: paths.filter((path) => !deferredMoviePaths.has(path) && ['unmatched', 'error'].includes(movieMatches[path]?.status ?? '')).length,
    detecting: paths.filter((path) => !deferredMoviePaths.has(path) && (!movieMatches[path] || movieMatches[path]?.status === 'detecting')).length,
    deferred: deferredMoviePaths.size,
  }), [deferredMoviePaths, movieMatches, paths]);
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
    const metadataOverride = metadataOverrides[path];
    const matchedMovie = movieMatches[path]?.movie;
    const movieForPath = matchedMovie ? {
      ...matchedMovie,
      name: metadataOverride?.name.trim() || matchedMovie.name,
      year: metadataOverride ? optionalMetadataNumber(metadataOverride.year) : matchedMovie.year,
      id: metadataOverride?.providerId.trim() || matchedMovie.id,
    } : undefined;
    const matchedEpisodes = item?.match ? candidateEpisodes(item.match) : [];
    const effectiveEpisodes = metadataOverride?.episodes.length ? metadataOverride.episodes.map((episode) => ({
      ...(matchedEpisodes.find((candidate) => candidate.id === episode.id) ?? { id: episode.id }),
      season: Number(episode.season),
      number: Number(episode.number),
      title: episode.title.trim(),
    } satisfies Episode)) : matchedEpisodes;
    const detectedTags = parseReleaseTags(path, releaseAliases);
    const movieEdition = activeMediaTab === 'movies' && movieForPath ? parseMovieEdition(path, movieForPath.name, movieForPath.year) : undefined;
    const baseTags = detectedTags ? {
      ...detectedTags,
      ...(activeMediaTab === 'movies' ? { edition: movieEdition?.edition, editionError: movieEdition?.error } : {}),
      ...(metadataOverride ? {
        edition: metadataOverride.edition.trim() || undefined,
        editionError: undefined,
        resolution: metadataOverride.resolution.trim() || undefined,
        source: metadataOverride.source,
        videoCodec: metadataOverride.videoCodec.trim() || undefined,
        audioCodec: metadataOverride.audioCodec.trim() || undefined,
        channels: metadataOverride.channels.trim() || undefined,
        webOrigin: metadataOverride.webOrigin.trim() || undefined,
        webOriginShort: metadataOverride.webOriginShort.trim() || undefined,
        group: metadataOverride.group.trim() || undefined,
        flags: metadataOverride.flags.split(',').map((flag) => flag.trim()).filter(Boolean),
      } : {}),
    } : undefined;
    const tags = baseTags ? applyReleaseOverrides({ ...baseTags, ...technicalTags[path] }, {
      source: sourceOverride === 'auto' ? undefined : sourceOverride,
      aiUpscale: aiUpscaleOverride === 'auto' ? undefined : aiUpscaleOverride === 'on',
    }) : undefined;
    const extension = filenameFromPath(path).match(/(\.[^.]+)$/)?.[1] ?? '';
    const effectiveShowName = metadataOverride?.name.trim() || show?.name;
    const effectiveShowYear = metadataOverride ? optionalMetadataNumber(metadataOverride.year) : show?.year;
    const effectiveTvdbId = metadataOverride?.providerId.trim() || show?.tvdbId;
    const showFolder = effectiveEpisodes.length && effectiveShowName && !folderFormatError ? formatShowFolder(showFolderTemplate, effectiveShowName, effectiveShowYear, effectiveTvdbId, effectiveEpisodes[0].season) : undefined;
    const movieFolder = movieForPath && !movieFolderFormatError ? formatMovieFolder(movieFolderTemplate, movieForPath.name, movieForPath.year, movieForPath.id, tags?.edition) : undefined;
    const companions = companionScan.byVideo[path] ?? [];
    const encoder = new TextEncoder();
    const extensionBytes = encoder.encode(extension).length;
    const longestCompanionSuffix = companions.reduce((longest, companion) => Math.max(longest, encoder.encode(companion.suffix).length), 0);
    const videoFilenameBudget = 255 - Math.max(0, longestCompanionSuffix - extensionBytes);
    const targetName = activeMediaTab === 'movies'
      ? movieForPath && tags && !movieFormatError ? formatMovieFilename(movieTemplate, movieForPath.name, movieForPath.year, tags, extension, movieForPath.id, videoFilenameBudget) : undefined
      : effectiveEpisodes.length && effectiveShowName && tags && !formatError ? formatEpisodeFilename(episodeTemplate, effectiveShowName, effectiveShowYear, effectiveEpisodes, tags, extension, effectiveTvdbId, videoFilenameBudget) : undefined;
    return {
      sourcePath: path,
      targetName,
      targetDirectory: moveFiles && activeMediaTab === 'movies' && movieFolder !== undefined ? destinationDirectoryForSource(path, movieBaseFolder, movieFolder) : moveFiles && showFolder !== undefined ? destinationDirectoryForSource(path, tvBaseFolder, showFolder) : undefined,
      configurationError: activeMediaTab === 'movies' && deferredMoviePaths.has(path)
        ? 'This filename contains TV episode numbering. Open it in TV mode or remove it from the movie batch.'
        : tags?.editionError ?? (moveFiles && activeMediaTab === 'movies' && movieFolderFormatError ? `Fix the movie folder pattern: ${movieFolderFormatError}` : moveFiles && activeMediaTab === 'shows' && folderFormatError ? `Fix the show folder pattern: ${folderFormatError}` : undefined),
      companionError: ambiguousCompanionsByVideo.get(path)?.length ? `${ambiguousCompanionsByVideo.get(path)!.length} companion file${ambiguousCompanionsByVideo.get(path)!.length === 1 ? '' : 's'} could belong to more than one imported video.` : undefined,
      companions,
      matchStatus: activeMediaTab === 'movies' ? movieMatches[path]?.status === 'confident' ? 'confident' : movieMatches[path]?.status === 'review' ? 'review' : 'pending' : confirmedPaths.has(path) ? 'confident' : item?.status ?? 'pending',
      confidence: activeMediaTab === 'movies' ? movieMatches[path]?.confidence ?? 0 : item?.match?.score ?? 0,
    };
  })), [activeMediaTab, aiUpscaleOverride, ambiguousCompanionsByVideo, companionScan.byVideo, confirmedPaths, deferredMoviePaths, episodeTemplate, folderFormatError, formatError, matchesByPath, metadataOverrides, moveFiles, movieBaseFolder, movieFolderFormatError, movieFolderTemplate, movieFormatError, movieMatches, movieTemplate, paths, releaseAliases, show, showFolderTemplate, sourceOverride, technicalTags, tvBaseFolder]);
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
  const unchangedPaths = useMemo(() => unchangedRenameItemPaths(preflightPlan), [preflightPlan]);

  function showFirstBlockedFile() {
    const blocked = preflightPlan.items.find((item) => [...item.issues, ...item.companions.flatMap((companion) => companion.issues)].some((issue) => issue.severity === 'error'));
    if (!blocked) return;
    const row = matchRowElements.current.get(blocked.sourcePath);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => row?.focus({ preventScroll: true }), 350);
  }

  function clearUnchangedFiles() {
    if (!unchangedPaths.length || removalTimers.current.__clearUnchanged !== undefined) return;
    const targets = new Set(unchangedPaths);
    setBatchRenameCompleted(false);
    setRemovingPaths((current) => new Set([...current, ...targets]));
    removalTimers.current.__clearUnchanged = window.setTimeout(() => {
      const withoutPaths = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([path]) => !targets.has(path)));
      for (const path of targets) {
        probeRuns.current[path] = (probeRuns.current[path] ?? 0) + 1;
        probedPaths.current.delete(path);
        matchRowElements.current.delete(path);
      }
      setPaths((current) => current.filter((path) => !targets.has(path)));
      setTechnicalTags(withoutPaths);
      setProbeStates(withoutPaths);
      setMatchOverrides(withoutPaths);
      setMovieMatches(withoutPaths);
      setMetadataOverrides(withoutPaths);
      setConfirmedPaths((current) => new Set([...current].filter((path) => !targets.has(path))));
      setHeldConfirmationPaths((current) => new Set([...current].filter((path) => !targets.has(path))));
      setCompanionScan((current) => ({
        byVideo: withoutPaths(current.byVideo),
        ambiguous: current.ambiguous.map((item) => ({ ...item, candidateVideoPaths: item.candidateVideoPaths.filter((path) => !targets.has(path)) })).filter((item) => item.candidateVideoPaths.length > 0),
      }));
      if (reviewingPath && targets.has(reviewingPath)) setReviewingPath(undefined);
      if (movieReviewPath && targets.has(movieReviewPath)) { setMovieReviewPath(undefined); setMovieReviewResults([]); setMovieReviewSelection(undefined); }
      if (editingMetadataPath && targets.has(editingMetadataPath)) { setEditingMetadataPath(undefined); setMetadataDraft(undefined); }
      if (pinnedPreviewPath && targets.has(pinnedPreviewPath)) setPinnedPreviewPath(undefined);
      setRemovingPaths((current) => new Set([...current].filter((path) => !targets.has(path))));
      delete removalTimers.current.__clearUnchanged;
      addDebug('info', `Cleared ${targets.size} unchanged file${targets.size === 1 ? '' : 's'} from the batch`, 'Every removed video and companion already had its proposed name and location. No files were changed on disk.');
    }, 360);
  }

  useEffect(() => {
    let active = true;
    if (!window.mediaRenamer?.loadPreferences) {
      setPreferencesHydrated(true);
      return;
    }
    void window.mediaRenamer.loadPreferences().then((saved) => {
      if (!active) return;
      if (saved.episodeTemplate !== undefined) setEpisodeTemplate(saved.episodeTemplate === PREVIOUS_DEFAULT_EPISODE_TEMPLATE || saved.episodeTemplate === PREVIOUS_TVDB_DEFAULT_EPISODE_TEMPLATE ? DEFAULT_EPISODE_TEMPLATE : saved.episodeTemplate);
      if (saved.fileViewMode !== undefined) setFileViewMode(saved.fileViewMode);
      if (saved.matchConfidenceThreshold !== undefined) setMatchConfidenceThreshold(saved.matchConfidenceThreshold);
      if (saved.movieBaseFolder !== undefined) setMovieBaseFolder(saved.movieBaseFolder);
      if (saved.movieFolderTemplate !== undefined) setMovieFolderTemplate(saved.movieFolderTemplate === PREVIOUS_DEFAULT_MOVIE_FOLDER_TEMPLATE ? DEFAULT_MOVIE_FOLDER_TEMPLATE : saved.movieFolderTemplate);
      if (saved.movieTemplate !== undefined) setMovieTemplate(saved.movieTemplate === PREVIOUS_DEFAULT_MOVIE_TEMPLATE || saved.movieTemplate === PREVIOUS_EDITION_DEFAULT_MOVIE_TEMPLATE ? DEFAULT_MOVIE_TEMPLATE : saved.movieTemplate);
      if (saved.removeEmptySourceParents !== undefined) setRemoveEmptySourceParents(saved.removeEmptySourceParents);
      if (saved.releaseAliasText !== undefined) setReleaseAliasText(saved.releaseAliasText);
      if (saved.savedMatchDecisions !== undefined) setSavedMatchDecisions(saved.savedMatchDecisions);
      if (saved.autoClearCompletedBatch !== undefined) setAutoClearCompletedBatch(saved.autoClearCompletedBatch);
      if (saved.completionChime !== undefined) setCompletionChime(saved.completionChime);
      if (saved.completionReport !== undefined) setCompletionReport(saved.completionReport);
      if (saved.clearSourceJunk !== undefined) setClearSourceJunk(saved.clearSourceJunk);
      if (saved.createExternalRenameLog !== undefined) setCreateExternalRenameLog(saved.createExternalRenameLog);
      if (saved.renameLogFolder !== undefined) setRenameLogFolder(saved.renameLogFolder);
      if (saved.showFolderTemplate !== undefined) setShowFolderTemplate(saved.showFolderTemplate);
      if (saved.titleMatching !== undefined) setTitleMatching(saved.titleMatching);
      if (saved.tvBaseFolder !== undefined) setTvBaseFolder(saved.tvBaseFolder);
    }).catch((reason) => addDebug('warning', 'Could not load saved preferences', errorMessage(reason))).finally(() => {
      if (active) setPreferencesHydrated(true);
    });
    return () => { active = false; };
  }, [addDebug]);

  useEffect(() => {
    localStorage.setItem('media-renamer-episode-template', episodeTemplate);
  }, [episodeTemplate]);

  useEffect(() => {
    localStorage.setItem('media-renamer-match-confidence-threshold', String(matchConfidenceThreshold));
  }, [matchConfidenceThreshold]);

  useEffect(() => {
    localStorage.setItem('media-renamer-remove-empty-source-parents', String(removeEmptySourceParents));
  }, [removeEmptySourceParents]);

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

  useEffect(() => {
    if (!preferencesHydrated || !window.mediaRenamer?.savePreferences) return;
    void window.mediaRenamer.savePreferences({
      autoClearCompletedBatch,
      completionChime,
      completionReport,
      clearSourceJunk,
      createExternalRenameLog,
      episodeTemplate,
      fileViewMode,
      matchConfidenceThreshold,
      movieBaseFolder,
      movieFolderTemplate,
      movieTemplate,
      removeEmptySourceParents,
      releaseAliasText,
      savedMatchDecisions,
      renameLogFolder,
      showFolderTemplate,
      titleMatching,
      tvBaseFolder,
    }).catch((reason) => addDebug('warning', 'Could not save preferences', errorMessage(reason)));
  }, [addDebug, autoClearCompletedBatch, clearSourceJunk, completionChime, completionReport, createExternalRenameLog, episodeTemplate, fileViewMode, matchConfidenceThreshold, movieBaseFolder, movieFolderTemplate, movieTemplate, preferencesHydrated, releaseAliasText, removeEmptySourceParents, renameLogFolder, savedMatchDecisions, showFolderTemplate, titleMatching, tvBaseFolder]);

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
    if (!renaming || renameStartedAt === undefined) return;
    setRenameClock(Date.now());
    const timer = window.setInterval(() => setRenameClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [renameStartedAt, renaming]);

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
    window.mediaRenamer?.watchFiles(paths).catch((reason) => addDebug('warning', 'Could not monitor imported files', errorMessage(reason)));
  }, [addDebug, paths]);

  useEffect(() => window.mediaRenamer?.onWatchedFilesChanged((changes) => {
    const moved = new Map(changes.flatMap((change) => change.type === 'moved' ? [[change.previousPath, change.path] as const] : []));
    const deleted = new Set(changes.flatMap((change) => change.type === 'deleted' ? [change.path] : []));
    const nextPath = (filePath: string) => moved.get(filePath) ?? filePath;
    const remapRecord = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).flatMap(([key, value]) => deleted.has(key) ? [] : [[nextPath(key), value]]));

    for (const filePath of deleted) {
      probeRuns.current[filePath] = (probeRuns.current[filePath] ?? 0) + 1;
      probedPaths.current.delete(filePath);
      const timer = removalTimers.current[filePath];
      if (timer !== undefined) window.clearTimeout(timer);
      delete removalTimers.current[filePath];
      addDebug('warning', `Removed missing file: ${filenameFromPath(filePath)}`, 'The file was deleted outside Media Renamer.');
    }
    for (const [previousPath, filePath] of moved) {
      if (probedPaths.current.delete(previousPath)) probedPaths.current.add(filePath);
      if (probeRuns.current[previousPath] !== undefined) {
        probeRuns.current[filePath] = probeRuns.current[previousPath];
        delete probeRuns.current[previousPath];
      }
      addDebug('info', `Tracked renamed file: ${filenameFromPath(filePath)}`, `Previous path: ${previousPath}`);
    }

    setPaths((current) => [...new Set(current.flatMap((filePath) => deleted.has(filePath) ? [] : [nextPath(filePath)]))]);
    setMatches((current) => current.flatMap((item) => deleted.has(item.path) ? [] : [{ ...item, path: nextPath(item.path), filename: filenameFromPath(nextPath(item.path)), tags: moved.has(item.path) ? parseReleaseTags(nextPath(item.path), releaseAliases) : item.tags }]));
    setTechnicalTags(remapRecord);
    setProbeStates(remapRecord);
    setMatchOverrides(remapRecord);
    setConfirmedPaths((current) => new Set([...current].flatMap((filePath) => deleted.has(filePath) ? [] : [nextPath(filePath)])));
    setRemovingPaths((current) => new Set([...current].flatMap((filePath) => deleted.has(filePath) ? [] : [nextPath(filePath)])));
    setReviewingPath((current) => current && !deleted.has(current) ? nextPath(current) : undefined);
    setPinnedPreviewPath((current) => current && !deleted.has(current) ? nextPath(current) : undefined);
    setBatchRenameCompleted(false);
  }), [addDebug, releaseAliases]);

  useEffect(() => {
    if (!window.mediaRenamer?.probeMedia) return;
    const pending = paths.filter((path) => !probedPaths.current.has(path));
    if (!pending.length) return;
    void inspectMedia(pending);
  }, [inspectMedia, paths]);

  useEffect(() => {
    if (!preferencesOpen && !refreshConfirmation && !clearConfirmation && !confirmAllOpen && !renameConfirmationOpen && !undoConfirmationOpen && !renameReport && !batchMetadataOpen && !posterPreviewOpen && !reviewingPath && !movieReviewPath && !pinnedPreviewPath) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !renaming && !undoing) { setPreferencesOpen(false); setTemplateReferenceOpen(false); setRefreshConfirmation(false); setClearConfirmation(false); setConfirmAllOpen(false); setRenameConfirmationOpen(false); setUndoConfirmationOpen(false); setRenameReport(undefined); setBatchMetadataOpen(false); setPosterPreviewOpen(false); setPosterZoomed(false); setReviewingPath(undefined); setMovieReviewPath(undefined); setPinnedPreviewPath(undefined); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [preferencesOpen, refreshConfirmation, clearConfirmation, confirmAllOpen, renameConfirmationOpen, undoConfirmationOpen, renameReport, renaming, undoing, batchMetadataOpen, posterPreviewOpen, reviewingPath, movieReviewPath, pinnedPreviewPath]);

  useEffect(() => {
    window.mediaRenamer?.providerStatus().then((status) => {
      setProvider(status);
      addDebug(status.configured ? 'success' : 'warning', status.configured ? 'TMDB provider configured' : 'TMDB provider is not configured');
      addDebug(status.tvdbConfigured ? 'success' : 'warning', status.tvdbConfigured ? 'TVDB provider configured' : 'TVDB provider is not configured');
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
      addDebug('warning', 'Could not infer a show name', 'No supported episode marker or Show/Season/Episode folder structure was found.');
      return;
    }
    addDebug('info', `Inferred show query: ${inferred}`, `Derived from ${paths.length} imported file${paths.length === 1 ? '' : 's'}.`);
    autoSelectResult.current = true;
    setQuery(inferred);
  }, [activeMediaTab, addDebug, paths, provider?.configured, query, show]);

  useEffect(() => {
    if (activeMediaTab !== 'movies' || !provider?.configured || paths.length === 0) return;
    const eligiblePaths = paths.filter((path) => classifyMediaFile(path) !== 'shows');
    const sequence = ++movieBatchSequence.current;
    let cancelled = false;
    setMovieMatches((current) => Object.fromEntries(eligiblePaths.map((path) => {
      const existing = current[path];
      return [path, existing ?? { path, query: inferMovieQuery([path]) ?? '', candidates: [], status: 'detecting', confidence: 0, reasons: [] }];
    })));
    const pending = eligiblePaths.filter((path) => !movieMatches[path]);
    if (!pending.length) return;
    setWork({ operation: 'Importing', completed: 0, total: pending.length });
    addDebug('info', `Detecting ${pending.length} movie${pending.length === 1 ? '' : 's'}`, 'Inferring a separate TMDB search from each imported filename.');
    let cursor = 0;
    let completed = 0;
    const detectNext = async () => {
      while (!cancelled) {
        const path = pending[cursor++];
        if (!path) return;
        const inferredQueries = inferMovieQueryCandidates([path]);
        const inferred = inferredQueries[0];
        let match: MovieFileMatch;
        if (!inferred) {
          match = { path, query: '', candidates: [], status: 'unmatched', confidence: 0, reasons: ['could not infer a title'] };
        } else {
          try {
            let matchedQuery = inferred;
            let found: MovieSearchResult[] = [];
            for (const candidateQuery of inferredQueries) {
              matchedQuery = candidateQuery;
              found = await window.mediaRenamer?.searchMovies(candidateQuery) ?? [];
              if (found.length) break;
            }
            match = chooseMovieMatch(path, matchedQuery, found);
            if (match.movie && window.mediaRenamer?.getMovie) {
              const matchedMovie = match.movie;
              try {
                const details = await window.mediaRenamer.getMovie(matchedMovie.id);
                if (details) match = { ...match, movie: details, candidates: match.candidates.map((candidate) => candidate.id === details.id ? details : candidate) };
              } catch (reason) {
                addDebug('warning', `Could not load artwork for ${matchedMovie.name}`, errorMessage(reason));
              }
            }
          } catch (reason) {
            match = { path, query: inferred, candidates: [], status: 'error', confidence: 0, reasons: ['TMDB search failed'], error: errorMessage(reason) };
          }
        }
        if (cancelled || movieBatchSequence.current !== sequence) return;
        setMovieMatches((current) => ({ ...current, [path]: match }));
        completed += 1;
        setWork({ operation: 'Importing', completed, total: pending.length });
        const destination = match.movie ? `${match.movie.name}${match.movie.year ? ` (${match.movie.year})` : ''}` : 'no match';
        addDebug(match.status === 'confident' ? 'success' : match.status === 'review' ? 'warning' : 'error', `${filenameFromPath(path)} → ${destination}`, `${Math.round(match.confidence * 100)}% confidence · ${match.reasons.join(' + ')}`);
      }
    };
    void Promise.all(Array.from({ length: Math.min(3, pending.length) }, () => detectNext())).finally(() => {
      if (!cancelled && movieBatchSequence.current === sequence) setWork(undefined);
    });
    return () => { cancelled = true; };
  // Movie match updates are intentionally excluded: this run owns the paths present when it starts.
  }, [activeMediaTab, addDebug, paths, provider?.configured]);

  useEffect(() => {
    setMatchOverrides({});
    setConfirmedPaths(new Set());
    setHeldConfirmationPaths(new Set());
    setReviewingPath(undefined);
    setPinnedPreviewPath(undefined);
  }, [episodes, matchConfidenceThreshold, titleMatching]);

  useEffect(() => {
    if (activeMediaTab === 'movies') {
      setMatchOverrides({});
      setConfirmedPaths(new Set());
      setHeldConfirmationPaths(new Set());
      setReviewingPath(undefined);
      setPinnedPreviewPath(undefined);
      setMatches(paths.flatMap((path) => {
        const match = movieMatches[path];
        return match ? [{
        path,
        filename: filenameFromPath(path),
        tags: parseReleaseTags(path, releaseAliases),
        match: match.movie ? { episode: { id: match.movie.id, season: 0, number: 0, title: match.movie.name }, score: match.confidence, reasons: match.reasons } : undefined,
        alternatives: [],
        status: match.status === 'confident' ? 'confident' : match.status === 'review' ? 'review' : 'unmatched',
      } satisfies FileMatch] : [];
      }));
      return;
    }
    if (paths.length === 0 || episodes.length === 0) {
      setMatches([]);
      setMatchOverrides({});
      setConfirmedPaths(new Set());
      setHeldConfirmationPaths(new Set());
      setReviewingPath(undefined);
      setPinnedPreviewPath(undefined);
      setWork(undefined);
      return;
    }

    let worker: Worker | undefined;
    // ffprobe jobs finish in small bursts; wait briefly so duration updates trigger one rematch instead of one worker per file.
    const start = window.setTimeout(() => {
      worker = new Worker(new URL('./workers/matchWorker.ts', import.meta.url), { type: 'module' });
      setWork({ operation: 'Importing', completed: 0, total: paths.length });
      addDebug('info', `Matching ${paths.length} file${paths.length === 1 ? '' : 's'}`, `Comparing against ${episodes.length} episodes in a background worker.`);
      worker.onmessage = (event: MessageEvent<{ type: 'progress'; completed: number; total: number } | { type: 'complete'; matches: FileMatch[] }>) => {
        if (event.data.type === 'progress') {
          setWork({ operation: 'Importing', completed: event.data.completed, total: event.data.total });
        } else {
          setMatches(event.data.matches);
          for (const item of event.data.matches) {
            const score = Math.round((item.match?.score ?? 0) * 100);
            const target = item.match ? `${candidateLabel(item.match)} ${candidateTitle(item.match)}` : 'no episode';
            const evidence = item.match?.reasons.length ? item.match.reasons.join('; ') : 'no sufficiently strong matching evidence';
            if (item.status === 'confident') addDebug('success', `Accepted ${item.filename} → ${target}`, `${score}% confidence: ${evidence}.`);
            else if (item.status === 'review') addDebug('warning', `Review ${item.filename} → ${target}`, `${score}% confidence: ${evidence}. Manual confirmation is required.`);
            else addDebug('error', `Rejected ${item.filename}`, `${score}% confidence: ${evidence}.`);
          }
          setWork(undefined);
          worker?.terminate();
        }
      };
      worker.onerror = () => {
        setError('The file matching worker stopped unexpectedly.');
        addDebug('error', 'File matching worker stopped unexpectedly');
        setWork(undefined);
        worker?.terminate();
      };
      worker.postMessage({ paths, episodes, titleMatching, confidenceThreshold: matchConfidenceThreshold / 100, showTitle: show?.name, durationsByPath: Object.fromEntries(paths.map((path) => [path, technicalTags[path]?.durationSeconds])) });
    }, 120);
    return () => { window.clearTimeout(start); worker?.terminate(); };
  }, [activeMediaTab, addDebug, movieMatches, paths, releaseAliases, episodes, show?.name, technicalTags, titleMatching, matchConfidenceThreshold]);

  useEffect(() => {
    const trimmed = query.trim();
    if (activeMediaTab !== 'shows' || !provider?.configured || trimmed.length < 2 || (show?.name && trimmed === show.name)) {
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
        const found = await window.mediaRenamer?.searchShows(trimmed) ?? [];
        if (searchSequence.current === sequence) {
          addDebug(found.length ? 'success' : 'warning', `Search returned ${found.length} result${found.length === 1 ? '' : 's'}`, found.length ? found.slice(0, 5).map((item) => `${item.name}${item.year ? ` (${item.year})` : ''}`).join(', ') : `No provider result matched “${trimmed}”.`);
          if (autoSelectResult.current && found[0]) {
            autoSelectResult.current = false;
            addDebug('info', `Automatically selecting ${found[0].name}`, 'Using the first result for the show name inferred from the imported files.');
            void selectShow(found[0]);
          } else {
            setActiveSearchResult(-1);
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
  }, [activeMediaTab, addDebug, provider?.configured, query, show?.name]);

  useEffect(() => {
    if (!movieReviewPath || !provider?.configured) return;
    const trimmed = movieReviewQuery.trim();
    if (trimmed.length < 2) {
      movieReviewSequence.current += 1;
      setMovieReviewResults([]);
      setMovieReviewSearching(false);
      return;
    }
    const sequence = ++movieReviewSequence.current;
    const timer = window.setTimeout(async () => {
      setMovieReviewSearching(true);
      setMovieReviewError(undefined);
      try {
        const found = await window.mediaRenamer?.searchMovies(trimmed) ?? [];
        if (movieReviewSequence.current !== sequence) return;
        setMovieReviewResults(found);
        setMovieReviewSelection((current) => found.some((movie) => movie.id === current) ? current : found[0]?.id);
        addDebug(found.length ? 'success' : 'warning', `Movie review search returned ${found.length} result${found.length === 1 ? '' : 's'}`, `Query: “${trimmed}”.`);
      } catch (reason) {
        if (movieReviewSequence.current === sequence) setMovieReviewError(errorMessage(reason));
      } finally {
        if (movieReviewSequence.current === sequence) setMovieReviewSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [addDebug, movieReviewPath, movieReviewQuery, provider?.configured]);

  async function selectShow(result: ShowSearchResult, episodeAgent: ShowMetadataAgent = showMetadataAgent) {
    setActiveSearchResult(-1);
    const sequence = ++seasonSequence.current;
    setQuery(result.name);
    autoSelectResult.current = false;
    setResults([]);
    setError(undefined);
    setLoadingEpisodes(true);
    addDebug('info', `Loading ${result.name}`, `${episodeAgent === 'tvdb-aired' ? 'TVDB aired order' : 'TMDB aired order'} selected for episode numbering and titles.`);
    try {
      const details = await window.mediaRenamer?.getShow(result.id);
      if (!details) {
        addDebug('error', `Could not load ${result.name}`, 'The metadata provider returned no show details.');
        return;
      }
      let tvdbId = details.tvdbId ?? result.tvdbId;
      if (episodeAgent === 'tvdb-aired' && !tvdbId) {
        const resolved = await window.mediaRenamer?.resolveTvdbSeries({ name: details.name, year: details.year });
        tvdbId = resolved?.id;
        if (resolved) addDebug('info', 'Resolved missing TVDB cross-reference', `${resolved.name}${resolved.year ? ` (${resolved.year})` : ''} · TVDB ${resolved.id}.`);
      }
      if (episodeAgent === 'tvdb-aired' && !tvdbId) throw new Error(`Could not safely resolve a TVDB series for ${details.name}. Choose the TMDB agent or search by tvdb-ID.`);
      const loadedEpisodes = await window.mediaRenamer?.getShowEpisodes({ agent: episodeAgent, tmdbId: details.id, tvdbId, seasons: details.seasons.map((season) => season.number) }) ?? [];
      if (seasonSequence.current === sequence) {
        const sortedEpisodes = loadedEpisodes.slice().sort((left, right) => left.season - right.season || left.number - right.number);
        const seasonNumbers = [...new Set(sortedEpisodes.map((episode) => episode.season))];
        const seasons = seasonNumbers.map((number) => {
          const existing = details.seasons.find((season) => season.number === number);
          return { number, name: existing?.name ?? (number === 0 ? 'Specials' : `Season ${number}`), episodeCount: sortedEpisodes.filter((episode) => episode.season === number).length, airDate: existing?.airDate };
        });
        setShow({ ...details, tvdbId, seasons });
        setEpisodes(sortedEpisodes);
        addDebug('success', `Loaded ${details.name}`, `${sortedEpisodes.length} ${episodeAgent === 'tvdb-aired' ? 'TVDB' : 'TMDB'} episodes across ${seasons.length} seasons.`);
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

  function openMovieMatchReview(path: string) {
    const match = movieMatches[path];
    if (!match || match.status === 'detecting') return;
    setMovieReviewPath(path);
    setMovieReviewQuery(match.query);
    setMovieReviewResults(match.candidates);
    setMovieReviewSelection(match.movie?.id ?? match.candidates[0]?.id);
    setMovieReviewError(undefined);
  }

  async function confirmMovieReview(selection = movieReviewSelection) {
    if (!movieReviewPath || !selection) return;
    const result = movieReviewResults.find((movie) => movie.id === selection);
    if (!result) return;
    setMovieReviewLoading(true);
    setMovieReviewError(undefined);
    try {
      const details = await window.mediaRenamer?.getMovie(result.id);
      if (!details) throw new Error('The metadata provider returned no movie details.');
      setMovieMatches((current) => ({ ...current, [movieReviewPath]: manuallySelectMovie(current[movieReviewPath] ?? { path: movieReviewPath, query: movieReviewQuery, candidates: [], status: 'review', confidence: 0, reasons: [] }, details) }));
      addDebug('success', `Matched ${filenameFromPath(movieReviewPath)} → ${details.name}`, `${details.year ?? 'Release year unknown'} · manually selected TMDB movie.`);
      setMovieReviewPath(undefined);
    } catch (reason) {
      const message = errorMessage(reason);
      setMovieReviewError(message);
      addDebug('error', `Could not load ${result.name}`, message);
    } finally {
      setMovieReviewLoading(false);
    }
  }

  function clearShowSearch() {
    searchSequence.current += 1;
    seasonSequence.current += 1;
    autoSelectResult.current = false;
    setQuery('');
    setResults([]);
    setActiveSearchResult(-1);
    setSearching(false);
    if (activeMediaTab === 'shows') {
      setShow(undefined);
      setEpisodes([]);
      setLoadingEpisodes(false);
    }
    searchInput.current?.focus();
  }

  function addImportedPaths(imported: string[]): void {
    const metadataAlreadyChosen = Boolean(show || query.trim() || results.length || searching || movieReviewPath || Object.keys(movieMatches).length);
    if (paths.length === 0 && !metadataAlreadyChosen) {
      const inferredKind = classifyMediaBatch(imported);
      if (inferredKind) {
        if (inferredKind !== activeMediaTab) switchMediaTab(inferredKind);
        addDebug('info', `Detected a ${inferredKind === 'movies' ? 'movie' : 'TV'} batch`, inferredKind === 'movies'
          ? 'Movie-style title, year, and release metadata were found without episode markers.'
          : 'Season, episode, special, or anime episode markers were found.');
      } else addDebug('info', 'Batch type was ambiguous', `Keeping the current ${activeMediaTab === 'movies' ? 'Movies' : 'TV'} mode.`);
    }
    setPaths((current) => [...new Set([...current, ...imported])]);
  }

  async function addFiles() {
    try {
      const selected = await window.mediaRenamer?.pickFiles();
      if (selected?.length) {
        setBatchRenameCompleted(false);
        addImportedPaths(selected);
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
        setBatchRenameCompleted(false);
        addImportedPaths(selected);
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

  async function chooseBaseFolder(kind: 'TV' | 'Movie' | 'Log') {
    try {
      const selected = await window.mediaRenamer?.pickDestinationFolder(kind);
      if (selected) (kind === 'TV' ? setTvBaseFolder : kind === 'Movie' ? setMovieBaseFolder : setRenameLogFolder)(selected);
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
        setBatchRenameCompleted(false);
        addImportedPaths(expanded);
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
    const preparedChime = completionChime ? prepareCompletionChime(palette) : undefined;
    setRenaming(true);
    setRenameControl(undefined);
    setRenameStartedAt(Date.now());
    setRenameClock(Date.now());
    setError(undefined);
    setWork({ operation: 'Renaming', completed: 0, total: executableFileCount });
    addDebug('info', `Renaming ${executableFileCount} file${executableFileCount === 1 ? '' : 's'}`, `${executableGroups.length} ${activeMediaTab === 'movies' ? 'movie' : 'episode'}${executableGroups.length === 1 ? '' : 's'} passed preflight.`);
    try {
      const preferredLogDirectory = renameLogFolder || (activeMediaTab === 'movies' ? movieBaseFolder : tvBaseFolder) || undefined;
      const result = await window.mediaRenamer.executeRenamePlan(executableGroups, {
        clearSourceJunk: moveFiles && clearSourceJunk,
        removeEmptySourceParents: moveFiles && removeEmptySourceParents,
        createExternalLog: createExternalRenameLog,
        externalLogDirectory: createExternalRenameLog ? preferredLogDirectory : undefined,
      });
      const removedDirectoryCount = result.operation.removedSourceDirectories?.length ?? 0;
      const removedJunkCount = result.operation.removedSourceJunkFiles?.length ?? 0;
      const resultLabel = result.operation.status === 'undone' ? 'Rename cancelled and undone' : result.operation.status === 'stopped' ? 'Rename stopped' : `Renamed ${result.operation.items.length} file${result.operation.items.length === 1 ? '' : 's'}`;
      addDebug(result.operation.status === 'completed' ? 'success' : 'warning', resultLabel, `Undo log: ${result.logPath}${result.operation.externalLogPath ? ` · Saved log: ${result.operation.externalLogPath}` : ''}${removedJunkCount ? ` · Cleared ${removedJunkCount} junk file${removedJunkCount === 1 ? '' : 's'}` : ''}${removedDirectoryCount ? ` · Removed ${removedDirectoryCount} empty source folder${removedDirectoryCount === 1 ? '' : 's'}` : ''}`);
      for (const warning of result.operation.sourceDirectoryCleanupWarnings ?? []) addDebug('warning', 'Source folder was kept', warning);
      if (result.operation.externalLogWarning) addDebug('warning', 'Could not save operation log', result.operation.externalLogWarning);
      const renamedVideos = new Set(result.operation.status === 'undone' ? [] : result.operation.items.filter((item) => isVideoPath(item.sourcePath)).map((item) => item.sourcePath));
      const entireBatchRenamed = paths.length > 0 && paths.every((path) => renamedVideos.has(path));
      setLastRename(result);
      if (completionReport) setRenameReport({ result, moved: moveFiles });
      if (result.operation.status === 'completed') preparedChime?.play();
      else preparedChime?.dispose();
      if (result.operation.status === 'undone') setBatchRenameCompleted(false);
      else if (entireBatchRenamed && autoClearCompletedBatch) clearBatch();
      else {
        replaceBatchPaths(result.operation.items, 'forward');
        setBatchRenameCompleted(entireBatchRenamed);
      }
      setRenameConfirmationOpen(false);
    } catch (reason) {
      preparedChime?.dispose();
      const message = errorMessage(reason);
      setError(message);
      addDebug('error', 'Rename operation failed', message);
    } finally {
      setRenaming(false);
      setRenameControl(undefined);
      setRenameStartedAt(undefined);
      setWork(undefined);
    }
  }

  function setCompletionChimeEnabled(enabled: boolean) {
    setCompletionChime(enabled);
    if (enabled) prepareCompletionChime(palette)?.play();
  }

  async function controlActiveRename(control: 'stop' | 'undo') {
    if (!renaming || renameControl || !window.mediaRenamer?.controlRename) return;
    setRenameControl(control);
    try {
      const accepted = await window.mediaRenamer.controlRename(control);
      if (!accepted) setRenameControl(undefined);
    } catch (reason) {
      setRenameControl(undefined);
      addDebug('error', `Could not ${control} rename`, errorMessage(reason));
    }
  }

  function replaceBatchPaths(items: Array<{ sourcePath: string; targetPath: string }>, direction: 'forward' | 'backward') {
    const replacements = new Map(items.map((item) => direction === 'forward' ? [item.sourcePath, item.targetPath] : [item.targetPath, item.sourcePath]));
    const remapRecord = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).map(([key, value]) => [replacements.get(key) ?? key, value]));
    setTechnicalTags(remapRecord);
    setProbeStates(remapRecord);
    setMetadataOverrides(remapRecord);
    probedPaths.current = new Set([...probedPaths.current].map((item) => replacements.get(item) ?? item));
    probeRuns.current = Object.fromEntries(Object.entries(probeRuns.current).map(([key, value]) => [replacements.get(key) ?? key, value]));
    setPaths((current) => current.length
      ? current.map((item) => replacements.get(item) ?? item)
      : items.filter((item) => isVideoPath(direction === 'forward' ? item.targetPath : item.sourcePath)).map((item) => direction === 'forward' ? item.targetPath : item.sourcePath));
  }

  async function undoLastRename() {
    if (!lastRename || !['completed', 'stopped'].includes(lastRename.operation.status) || !window.mediaRenamer?.undoRenameOperation || undoing || renaming) return;
    setUndoing(true);
    setError(undefined);
    setWork({ operation: 'Undoing', completed: 0, total: lastRename.operation.items.length });
    addDebug('info', `Undoing ${lastRename.operation.items.length} file operation${lastRename.operation.items.length === 1 ? '' : 's'}`, `Operation log: ${lastRename.logPath}`);
    try {
      const result = await window.mediaRenamer.undoRenameOperation(lastRename.operation.id);
      replaceBatchPaths(result.operation.items, 'backward');
      setBatchRenameCompleted(false);
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
    setMovieMatches({});
    setMovieReviewPath(undefined);
    setMovieReviewQuery('');
    setMovieReviewResults([]);
    setMovieReviewSelection(undefined);
    setMetadataOverrides({});
    setEditingMetadataPath(undefined);
    setMetadataDraft(undefined);
    setEpisodes([]);
    setLoadingEpisodes(false);
    setMatches([]);
    setMatchOverrides({});
    setConfirmedPaths(new Set());
    setHeldConfirmationPaths(new Set());
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
    setBatchRenameCompleted(false);
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
    setMovieMatches(withoutPath);
    setMetadataOverrides(withoutPath);
    setConfirmedPaths((current) => { const next = new Set(current); next.delete(path); return next; });
    setHeldConfirmationPaths((current) => { const next = new Set(current); next.delete(path); return next; });
    if (reviewingPath === path) setReviewingPath(undefined);
    if (movieReviewPath === path) { setMovieReviewPath(undefined); setMovieReviewResults([]); setMovieReviewSelection(undefined); }
    if (editingMetadataPath === path) { setEditingMetadataPath(undefined); setMetadataDraft(undefined); }
    if (pinnedPreviewPath === path) setPinnedPreviewPath(undefined);
    setRemovingPaths((current) => { const next = new Set(current); next.delete(path); return next; });
    delete removalTimers.current[path];
    addDebug('info', `Removed ${filenameFromPath(path)} from the batch`, 'The source file was not changed on disk.');
  }

  function removeFileFromBatch(path: string) {
    if (removalTimers.current[path] !== undefined) return;
    setBatchRenameCompleted(false);
    setRemovingPaths((current) => new Set(current).add(path));
    removalTimers.current[path] = window.setTimeout(() => finishRemovingFile(path), 360);
  }

  function openMetadataEditor(path: string) {
    const saved = metadataOverrides[path];
    if (saved) {
      setMetadataDraft(structuredClone(saved));
      setEditingMetadataPath(path);
      return;
    }
    const item = matchesByPath.get(path);
    const movie = movieMatches[path]?.movie;
    const matchedEpisodes = item?.match ? candidateEpisodes(item.match) : [];
    if (activeMediaTab === 'movies' ? !movie : !show || !matchedEpisodes.length) return;
    const tags = applyReleaseOverrides({ ...parseReleaseTags(path, releaseAliases), ...technicalTags[path] }, {
      source: sourceOverride === 'auto' ? undefined : sourceOverride,
      aiUpscale: aiUpscaleOverride === 'auto' ? undefined : aiUpscaleOverride === 'on',
    });
    const edition = activeMediaTab === 'movies' && movie ? parseMovieEdition(path, movie.name, movie.year).edition : tags.edition;
    setMetadataDraft({
      name: activeMediaTab === 'movies' ? movie!.name : show!.name,
      year: String((activeMediaTab === 'movies' ? movie!.year : show!.year) ?? ''),
      providerId: activeMediaTab === 'movies' ? movie!.id : show!.tvdbId ?? '',
      episodes: activeMediaTab === 'shows' ? matchedEpisodes.map((episode) => ({ id: episode.id, season: String(episode.season), number: String(episode.number), title: episode.title })) : [],
      edition: edition ?? '',
      resolution: tags.resolution ?? '',
      source: tags.source,
      videoCodec: tags.videoCodec ?? '',
      audioCodec: tags.audioCodec ?? '',
      channels: tags.channels ?? '',
      webOrigin: tags.webOrigin ?? '',
      webOriginShort: tags.webOriginShort ?? '',
      group: tags.group ?? '',
      flags: tags.flags.join(', '),
    });
    setEditingMetadataPath(path);
  }

  function saveMetadataEditor() {
    if (!editingMetadataPath || !metadataDraft || validateMediaMetadata(metadataDraft, activeMediaTab === 'movies')) return;
    setMetadataOverrides((current) => ({ ...current, [editingMetadataPath]: structuredClone(metadataDraft) }));
    addDebug('success', `Updated metadata for ${filenameFromPath(editingMetadataPath)}`, 'Filename and destination previews were recalculated from the manual values.');
    setEditingMetadataPath(undefined);
    setMetadataDraft(undefined);
  }

  function confirmSuggestedMatch(path: string) {
    if (activeMediaTab === 'movies') {
      const match = movieMatches[path];
      if (!match?.movie || match.status !== 'review') return;
      setMovieMatches((current) => ({ ...current, [path]: confirmSuggestedMovie(current[path]) }));
      addDebug('success', `Confirmed ${filenameFromPath(path)} → ${match.movie.name}${match.movie.year ? ` (${match.movie.year})` : ''}`, match.reasons.join('; ') || 'Accepted the suggested movie.');
      return;
    }
    const item = matchesByPath.get(path);
    if (!item?.match) return;
    rememberMatchDecision(path, item.match);
    setConfirmedPaths((current) => new Set(current).add(path));
    setHeldConfirmationPaths((current) => new Set(current).add(path));
    addDebug('success', `Confirmed ${item.filename} → ${candidateLabel(item.match)} ${candidateTitle(item.match)}`, item.match.reasons.join('; ') || 'Accepted the suggested match.');
  }

  function confirmAllSuggestedMatches() {
    if (!confirmablePaths.length) return;
    if (activeMediaTab === 'movies') {
      setMovieMatches((current) => Object.fromEntries(Object.entries(current).map(([path, match]) => [path, confirmablePaths.includes(path) ? confirmSuggestedMovie(match) : match])));
    } else {
      setSavedMatchDecisions((current) => confirmablePaths.reduce((next, path) => {
        const candidate = matchesByPath.get(path)?.match;
        return candidate && showMatchDecisionId ? saveMatchDecision(next, showMatchDecisionId, path, candidate) : next;
      }, current));
      setConfirmedPaths((current) => new Set([...current, ...confirmablePaths]));
      setHeldConfirmationPaths(new Set());
    }
    addDebug('success', `Confirmed ${confirmablePaths.length} suggested ${activeMediaTab === 'movies' ? 'movie' : 'episode'} match${confirmablePaths.length === 1 ? '' : 'es'}`, confirmationBlockers.length ? `${confirmationBlockers.length} file${confirmationBlockers.length === 1 ? '' : 's'} still require manual matching.` : 'All currently suggested matches were accepted.');
    setConfirmAllResult({ confirmed: confirmablePaths.length, remaining: confirmationBlockers });
  }

  function reviewFromConfirmation(path: string) {
    setConfirmAllOpen(false);
    setConfirmAllResult(undefined);
    if (activeMediaTab === 'movies') openMovieMatchReview(path);
    else openMatchReview(path);
  }

  function openMatchReview(path: string) {
    const item = matchesByPath.get(path);
    setReviewingPath(path);
    setReviewSearch('');
    setReviewCandidate(item?.match);
  }

  function confirmMatchReview(candidate = reviewCandidate) {
    if (!reviewingPath || !candidate) return;
    rememberMatchDecision(reviewingPath, candidate);
    setMatchOverrides((current) => ({ ...current, [reviewingPath]: candidate }));
    setConfirmedPaths((current) => new Set(current).add(reviewingPath));
    addDebug('success', `Confirmed ${filenameFromPath(reviewingPath)} → ${candidateLabel(candidate)} ${candidateTitle(candidate)}`, candidate.reasons.join('; ') || 'Manually confirmed.');
    setReviewingPath(undefined);
  }

  function rememberMatchDecision(path: string, candidate: MatchCandidate) {
    if (!showMatchDecisionId) return;
    setSavedMatchDecisions((current) => saveMatchDecision(current, showMatchDecisionId, path, candidate));
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
    setQuery(tab === 'movies' ? '' : show?.name ?? '');
    setResults([]);
    setSearching(false);
    setError(undefined);
    setReviewingPath(undefined);
    setMovieReviewPath(undefined);
    setMovieReviewResults([]);
    setPinnedPreviewPath(undefined);
  }

  const activeTitle = activeMediaTab === 'shows' ? show : undefined;
  const selectablePalettes = availablePalettes(new Date(), import.meta.env.DEV);
  const metadataDraftError = metadataDraft ? validateMediaMetadata(metadataDraft, activeMediaTab === 'movies') : undefined;
  const metadataDraftPreview = editingMetadataPath && metadataDraft && !metadataDraftError ? (() => {
    const extension = filenameFromPath(editingMetadataPath).match(/(\.[^.]+)$/)?.[1] ?? '';
    const draftTags = {
      source: metadataDraft.source,
      edition: metadataDraft.edition.trim() || undefined,
      resolution: metadataDraft.resolution.trim() || undefined,
      videoCodec: metadataDraft.videoCodec.trim() || undefined,
      audioCodec: metadataDraft.audioCodec.trim() || undefined,
      channels: metadataDraft.channels.trim() || undefined,
      webOrigin: metadataDraft.webOrigin.trim() || undefined,
      webOriginShort: metadataDraft.webOriginShort.trim() || undefined,
      group: metadataDraft.group.trim() || undefined,
      flags: metadataDraft.flags.split(',').map((flag) => flag.trim()).filter(Boolean),
    };
    if (activeMediaTab === 'movies') return movieFormatError ? undefined : formatMovieFilename(movieTemplate, metadataDraft.name.trim(), optionalMetadataNumber(metadataDraft.year), draftTags, extension, metadataDraft.providerId.trim() || undefined);
    const draftEpisodes = metadataDraft.episodes.map((episode) => ({ id: episode.id, season: Number(episode.season), number: Number(episode.number), title: episode.title.trim() }));
    return formatError ? undefined : formatEpisodeFilename(episodeTemplate, metadataDraft.name.trim(), optionalMetadataNumber(metadataDraft.year), draftEpisodes, draftTags, extension, metadataDraft.providerId.trim() || undefined);
  })() : undefined;

  const renameCompleted = work?.completed ?? 0;
  const renameTotal = work?.total ?? executableFileCount;
  const renamePercent = renameTotal > 0 ? Math.min(100, Math.round((renameCompleted / renameTotal) * 100)) : 0;
  const renameElapsed = renameStartedAt === undefined ? 0 : Math.max(0, renameClock - renameStartedAt);
  const estimatedRenameTotal = renameCompleted > 0 && work?.operation !== 'Undoing' ? (renameElapsed / renameCompleted) * renameTotal : undefined;
  const estimatedRenameRemaining = estimatedRenameTotal === undefined ? undefined : Math.max(0, estimatedRenameTotal - renameElapsed);
  const reportOperation = renameReport?.result.operation;
  const reportWarnings = (reportOperation?.sourceDirectoryCleanupWarnings?.length ?? 0) + (reportOperation?.externalLogWarning ? 1 : 0);

  return (
    <div className={`app-shell platform-${window.mediaRenamer?.platform ?? 'web'} ${debugDocked ? `debug-docked dock-${dockPosition}` : ''} ${preferencesOpen ? 'preferences-open' : ''}`} style={{ '--debug-size': `${dockSizes[dockPosition]}px` } as CSSProperties}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Tv size={18} /></span> Media Renamer <span className="beta">ALPHA</span></div>
        <nav><button className={activeMediaTab === 'shows' ? 'nav-active' : ''} aria-pressed={activeMediaTab === 'shows'} onClick={() => switchMediaTab('shows')}><Tv size={15}/> {t('nav.tv')}</button><button className={activeMediaTab === 'movies' ? 'nav-active' : ''} aria-pressed={activeMediaTab === 'movies'} onClick={() => switchMediaTab('movies')}><Film size={15}/> {t('nav.movies')}</button></nav>
        <div className="topbar-actions">
          <button className={`icon-button ${preferencesOpen ? 'active' : ''}`} aria-label={preferencesOpen ? 'Close preferences' : 'Open preferences'} title={preferencesOpen ? 'Close preferences' : 'Preferences'} onClick={() => { if (preferencesOpen) { setPreferencesOpen(false); setTemplateReferenceOpen(false); } else { setPreferenceMediaTab(activeMediaTab); setPreferencesOpen(true); } }}><Settings size={18}/></button>
          <button className={`icon-button ${debugDocked ? 'active' : ''}`} aria-label="Toggle docked debug console" title="Toggle debug console" onClick={() => { if (debugDocked) setDebugDocked(false); else { setDebugDocked(true); void window.mediaRenamer?.dockDebugConsole(); } }}><SquareTerminal size={18}/></button>
        </div>
      </header>
      <SeasonalEffects palette={palette}/>

      <main>
        <section className="hero">
          <div className="show-identity">
            {activeTitle?.posterUrl && <button className="show-poster-button" aria-label={`View full poster for ${activeTitle.name}`} title="View full poster" onClick={() => { setPosterCanZoom(false); setPosterZoomed(false); setPosterPreviewOpen(true); }}><img className="show-poster" src={activeTitle.posterUrl} alt=""/></button>}
            <div>
              <p className="eyebrow">{activeMediaTab === 'movies' ? 'MOVIE BATCH' : t('hero.activeShow')}</p>
              {activeTitle?.logoUrl && <img className="show-logo" src={activeTitle.logoUrl} alt={`${activeTitle.name}${activeTitle.year ? ` (${activeTitle.year})` : ''}`} title={`${activeTitle.name}${activeTitle.year ? ` (${activeTitle.year})` : ''}`}/>}
              {!activeTitle?.logoUrl && <h1>{activeMediaTab === 'movies' ? `${paths.length} imported movie${paths.length === 1 ? '' : 's'}` : activeTitle ? <>{activeTitle.name} {activeTitle.year && <span>({activeTitle.year})</span>}</> : t('hero.chooseShow')}</h1>}
              <p>{activeMediaTab === 'movies' ? paths.length ? `${movieMatchCounts.ready} matched · ${movieMatchCounts.review} review · ${movieMatchCounts.unmatched} unmatched${movieMatchCounts.deferred ? ` · ${movieMatchCounts.deferred} deferred to TV` : ''}${movieMatchCounts.detecting ? ` · ${movieMatchCounts.detecting} detecting` : ''}` : 'Add movie files to detect each title independently' : show ? `${episodes.length} episodes · ${show.seasons.length} seasons · ${showMetadataAgent === 'tvdb-aired' ? 'TVDB' : 'TMDB'}` : `Search for a show · episodes from ${showMetadataAgent === 'tvdb-aired' ? 'TVDB' : 'TMDB'}`}</p>
            </div>
          </div>
          {activeMediaTab === 'shows' ? <div className="show-search">
            <div className="search"><Search size={17}/><input ref={searchInput} role="combobox" aria-autocomplete="list" aria-controls="media-search-results" aria-expanded={results.length > 0} aria-activedescendant={activeSearchResult >= 0 ? `media-search-result-${activeSearchResult}` : undefined} aria-label="Search TV shows" value={query} onChange={(event) => { autoSelectResult.current = false; setActiveSearchResult(-1); setQuery(event.target.value); if (event.target.value !== show?.name) { seasonSequence.current += 1; setShow(undefined); setEpisodes([]); setLoadingEpisodes(false); } }} onKeyDown={(event) => {
              if (!results.length) return;
              if (event.key === 'ArrowDown') { event.preventDefault(); setActiveSearchResult((current) => current < results.length - 1 ? current + 1 : 0); }
              else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveSearchResult((current) => current > 0 ? current - 1 : results.length - 1); }
              else if (event.key === 'Enter' && activeSearchResult >= 0) { event.preventDefault(); void selectShow(results[activeSearchResult]); }
            }} placeholder="Show name, tvdb-482771, or tmdb-…" autoComplete="off"/>{searching && <LoaderCircle className="spin" size={16}/>}{query ? <button className="search-clear" aria-label="Clear show search" title="Clear search" onClick={clearShowSearch}><X size={15}/></button> : !searching && <kbd>⌘ K</kbd>}</div>
            {results.length > 0 && <div className="search-results" id="media-search-results" role="listbox" aria-label="TV show search results">
              {results.map((result, index) => <button ref={(element) => { searchResultButtons.current[index] = element; }} id={`media-search-result-${index}`} role="option" aria-selected={activeSearchResult === index} className={activeSearchResult === index ? 'active' : ''} key={result.id} onMouseEnter={() => setActiveSearchResult(index)} onClick={() => void selectShow(result)}>
                {result.posterUrl ? <img src={result.posterUrl} alt=""/> : <span className="poster-placeholder"><Tv size={18}/></span>}
                <span><strong>{result.name}</strong><small>{result.year ?? 'Year unknown'}</small></span>
              </button>)}
            </div>}
          </div> : <div className="movie-search-hint"><ListChecks size={16}/><span><strong>Per-file movie matching</strong><small>Use the Match button on a row to search and replace its result.</small></span></div>}
        </section>

        {!provider?.configured && provider && <div className="notice"><AlertCircle size={17}/><span><strong>TMDB access token needed.</strong> Add <code>TMDB_ACCESS_TOKEN=…</code> to <code>.env</code>, then restart the app.</span></div>}
        {activeMediaTab === 'shows' && showMetadataAgent === 'tvdb-aired' && provider && !provider.tvdbConfigured && <div className="notice"><AlertCircle size={17}/><span><strong>TVDB API key needed for Plex-compatible episode ordering.</strong> Add <code>TVDB_API_KEY=…</code> to <code>.env</code>, then restart the app.</span></div>}
        {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}

        <section className="workflow">
          <aside className="episode-panel panel">
            <div className="panel-heading">
              <div><p className="eyebrow">{activeMediaTab === 'movies' ? t('prefs.movies').toUpperCase() : t('panel.episodes')}</p><h2>{activeMediaTab === 'movies' ? 'Batch status' : show ? `${show.seasons.length} seasons` : t('panel.selectShow')}</h2></div>
              {activeMediaTab === 'shows' && show && <span className="count">{episodes.length}</span>}
              {activeMediaTab === 'movies' && <span className="count">{paths.length}</span>}
            </div>
            <div className="episode-list">
              {activeMediaTab === 'movies' ? <div className="movie-summary"><strong>{movieMatchCounts.ready} matched</strong><span>{movieMatchCounts.review} need review · {movieMatchCounts.unmatched} unmatched{movieMatchCounts.deferred ? ` · ${movieMatchCounts.deferred} TV ${movieMatchCounts.deferred === 1 ? 'episode' : 'episodes'} deferred` : ''}</span><p>Use the Match button on any movie row. Episode-like files stay visible and are handled in TV mode.</p></div> : <>{loadingEpisodes && <div className="empty-state"><LoaderCircle className="spin" size={20}/>Loading episodes…</div>}
              {!loadingEpisodes && episodes.map((episode, index) => <div key={episode.id}>
                {episodes[index - 1]?.season !== episode.season && <div className="season-divider">{seasonHeading(episode.season)}</div>}
                <div className="episode"><span>{String(episode.number).padStart(2, '0')}</span><strong title={episode.title}>{episode.title}</strong>{attachedFileCountByEpisode.has(episode.id) && <Check size={14} aria-label={`Attached to ${attachedFileCountByEpisode.get(episode.id)} imported file${attachedFileCountByEpisode.get(episode.id) === 1 ? '' : 's'}`}><title>Attached to {attachedFileCountByEpisode.get(episode.id)} imported file{attachedFileCountByEpisode.get(episode.id) === 1 ? '' : 's'}</title></Check>}</div>
              </div>)}
              {!loadingEpisodes && episodes.length === 0 && <div className="empty-state">{t('panel.searchShow')}</div>}</>}
            </div>
          </aside>

          <section className={`match-panel panel ${fileDropActive ? 'drop-active' : ''}`} onDragEnter={enterFileDropTarget} onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} onDragLeave={leaveFileDropTarget} onDrop={dropFilesOnPanel}>
            <div className="panel-heading main-heading">
              <div><p className="eyebrow">{t('panel.matchReview')}</p><h2>{t('panel.importedFiles', { count: paths.length })}</h2></div>
              <div className="add-actions"><button className={`secondary ${moveFiles ? 'active' : ''}`} aria-pressed={moveFiles} title={moveFiles ? (activeMediaTab === 'movies' ? movieBaseFolder : tvBaseFolder) ? `Move renamed files into ${activeMediaTab === 'movies' ? movieBaseFolder : tvBaseFolder}` : `Create the ${activeMediaTab === 'movies' ? 'movie' : 'show'} folder beside each source file` : 'Rename files in their current folders'} onClick={() => setMoveFiles((enabled) => !enabled)}><FolderTree size={15}/>{t(moveFiles ? 'panel.moveFiles' : 'panel.inPlace')}</button><button className={`secondary ${sourceOverride !== 'auto' || aiUpscaleOverride !== 'auto' ? 'active' : ''}`} aria-expanded={batchMetadataOpen} onClick={() => setBatchMetadataOpen((open) => !open)}><SlidersHorizontal size={15}/> {t('panel.batchMetadata')}{(sourceOverride !== 'auto' || aiUpscaleOverride !== 'auto') && <span className="active-indicator"/>}</button><button className="secondary" disabled={!paths.length || inspectingAny} onClick={() => setRefreshConfirmation(true)}><RefreshCw size={15}/> {t('panel.refreshMedia')}</button><button className="secondary clear-batch" disabled={!paths.length} onClick={() => batchRenameCompleted ? clearBatch() : setClearConfirmation(true)}><Trash2 size={15}/> {t('panel.clearAll')}</button><button className="secondary" onClick={addFiles}><FolderOpen size={16}/> {t('panel.addFiles')}</button><button className="secondary" onClick={addFolders}><FolderPlus size={16}/> {t('panel.addFolder')}</button></div>
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
              {work.total > 0 && <SmoothProgress value={work.completed} max={work.total}/>}
            </div>}
            {paths.length > 0 && <div className={`plan-status ${preflightPlan.blockedCount || preflightError ? 'blocked' : 'ready'}`}>
              {checkingPlan ? <LoaderCircle className="spin" size={18}/> : preflightPlan.blockedCount || preflightError ? <TriangleAlert size={18}/> : <ShieldCheck size={18}/>}
              <span role="status" aria-live="polite"><strong>{checkingPlan ? 'Checking destination files…' : preflightError ? 'Could not verify rename destinations' : preflightPlan.blockedCount ? `${preflightPlan.blockedCount} file${preflightPlan.blockedCount === 1 ? '' : 's'} blocked` : 'Rename plan passed preflight'}</strong><small>{checkingPlan ? 'Duplicate names will be numbered automatically. Rename unlocks when the filesystem check finishes.' : preflightError ?? `${preflightPlan.readyCount} ready · ${companionCount} companion${companionCount === 1 ? '' : 's'} · ${preflightPlan.warningCount} warning${preflightPlan.warningCount === 1 ? '' : 's'}${preflightPlan.destinationDirectories.length ? ` · ${preflightPlan.destinationDirectories.length} destination folder${preflightPlan.destinationDirectories.length === 1 ? '' : 's'}` : ''}${preflightPlan.blockedCount ? ' · Review or ambiguous files must be resolved' : ' · No collisions detected'}`}</small></span>
              {preflightError && <button className="secondary" onClick={() => setPreflightAttempt((attempt) => attempt + 1)}>Retry</button>}
              {!preflightError && unchangedPaths.length > 0 && <button className="secondary clear-unchanged" onClick={clearUnchangedFiles}><Trash2 size={14}/> Clear {unchangedPaths.length} unchanged</button>}
              {!preflightError && preflightPlan.blockedCount > 0 && <button className="secondary show-blocked" onClick={showFirstBlockedFile}><Search size={14}/> Show blocked file</button>}
              {confirmationActionCount > 0 && <button className="secondary confirm-suggestions" onClick={() => { setConfirmAllResult(undefined); setConfirmAllOpen(true); }}><FileCheck2 size={15}/> {confirmationSuggestions.length ? `Review ${confirmationActionCount} match${confirmationActionCount === 1 ? '' : 'es'}` : `Resolve ${confirmationBlockers.length} unmatched`}</button>}
            </div>}
            {paths.length > 0 && <div className={`match-list view-${fileViewMode} ${pinnedPreviewPath ? 'has-pinned-preview' : ''}`}>
              {paths.map((path) => {
                const item = matchesByPath.get(path);
                const movieFileMatch = movieMatches[path];
                const deferredToTv = activeMediaTab === 'movies' && deferredMoviePaths.has(path);
                const filename = item?.filename ?? filenameFromPath(path);
                const baseTags = parseReleaseTags(path, releaseAliases);
                const tags = applyReleaseOverrides({ ...baseTags, ...technicalTags[path] }, {
                  source: sourceOverride === 'auto' ? undefined : sourceOverride,
                  aiUpscale: aiUpscaleOverride === 'auto' ? undefined : aiUpscaleOverride === 'on',
                });
                const probeState = probeStates[path];
                const inspecting = probeState === 'loading';
                const extension = filename.match(/(\.[^.]+)$/)?.[1] ?? '';
                const plannedTargetName = planItemsByPath.get(path)?.targetName;
                const plannedCompanions = planItemsByPath.get(path)?.companions ?? [];
                const activeFormatError = activeMediaTab === 'movies' ? movieFormatError : formatError;
                const activeFolderError = activeMediaTab === 'movies' ? movieFolderFormatError : folderFormatError;
                const output = plannedTargetName ? extension ? plannedTargetName.slice(0, -extension.length) : plannedTargetName : activeFormatError ? 'Fix the filename template' : moveFiles && activeFolderError ? `Fix the ${activeMediaTab === 'movies' ? 'movie' : 'show'} folder pattern` : 'No suggested name';
                const status = activeMediaTab === 'movies' ? deferredToTv ? 'deferred' : movieFileMatch?.status ?? 'detecting' : item?.status ?? 'pending';
                const confirmed = confirmedPaths.has(path);
                const detailTags = tags ? [tags.edition ? `Edition: ${tags.edition}` : undefined, tags.resolution, tags.source !== 'Unknown' ? tags.source : undefined, tags.webOrigin, tags.videoCodec, tags.audioCodec, tags.channels, ...tags.flags, tags.group].filter(Boolean) : [];
                const planIssues = planIssuesByPath.get(path) ?? [];
                const blockingIssue = planIssues.find((issue) => issue.severity === 'error');
                const fullProposedName = deferredToTv ? 'Deferred to TV mode' : plannedTargetName ?? (item ? output : `Waiting for ${activeMediaTab === 'movies' ? 'movie' : 'show'} metadata`);
                const previewPinned = pinnedPreviewPath === path;
                const removing = removingPaths.has(path);
                const matchingRequired = activeMediaTab === 'shows' && !confirmed && (status === 'review' || status === 'unmatched');
                const movieConfirmationRequired = activeMediaTab === 'movies' && !deferredToTv && movieFileMatch?.status === 'review' && Boolean(movieFileMatch.movie);
                const movieReviewRequired = activeMediaTab === 'movies' && !deferredToTv && movieFileMatch?.status !== 'confident';
                const confirmationHeld = heldConfirmationPaths.has(path);
                const keepReviewActionsFixed = matchingRequired || confirmationHeld;
                return <div className={`match-row-slot ${removing ? 'removing' : ''}`} key={path}><div className="match-row-collapse"><article ref={(element) => { if (element) matchRowElements.current.set(path, element); else matchRowElements.current.delete(path); }} tabIndex={blockingIssue ? -1 : undefined} className={`match-row ${activeMediaTab === 'movies' ? 'movie-batch-row' : ''} ${blockingIssue ? 'plan-blocked' : ''} ${previewPinned ? 'preview-pinned' : ''} ${removing ? 'removing' : ''}`} onPointerLeave={() => {
                  if (!confirmationHeld) return;
                  setHeldConfirmationPaths((current) => { const next = new Set(current); next.delete(path); return next; });
                }}>
                  <div className={`status-dot ${inspecting ? 'inspecting' : blockingIssue ? 'unmatched' : confirmed ? 'confirmed' : status}`}>{inspecting ? <LoaderCircle className="spin"/> : blockingIssue ? <X/> : confirmed || status === 'confident' ? <Check/> : status === 'review' ? '!' : status === 'unmatched' ? <X/> : status === 'deferred' ? <Tv/> : '…'}</div>
                  {activeMediaTab === 'movies' && <div className="movie-row-poster">{movieFileMatch?.movie?.posterUrl ? <img src={movieFileMatch.movie.posterUrl} alt=""/> : <Film size={18}/>}</div>}
                  <div className="file-content" tabIndex={fileViewMode === 'detailed' ? undefined : 0} role={fileViewMode === 'detailed' ? undefined : 'button'} aria-expanded={fileViewMode === 'detailed' ? undefined : previewPinned} aria-label={fileViewMode === 'detailed' ? undefined : `Show complete filenames for ${filename}`} onClick={() => { if (fileViewMode !== 'detailed') setPinnedPreviewPath((current) => current === path ? undefined : path); }} onKeyDown={(event) => { if (fileViewMode !== 'detailed' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setPinnedPreviewPath((current) => current === path ? undefined : path); } }}>
                    {activeMediaTab === 'movies' && movieFileMatch?.movie && <div className="movie-row-identity">{movieFileMatch.movie.logoUrl ? <img src={movieFileMatch.movie.logoUrl} alt={movieFileMatch.movie.name}/> : <strong>{movieFileMatch.movie.name}</strong>}<span>{movieFileMatch.movie.year ?? 'Year unknown'} · TMDB {movieFileMatch.movie.id}</span></div>}
                    <div className="file-pair"><div className="original"><FileVideo size={15}/><span>{filename}</span></div><div className="arrow"><ChevronRight size={15}/></div><div className="proposed">{deferredToTv ? 'TV episode detected' : item ? output : `Waiting for ${activeMediaTab === 'movies' ? 'movie' : 'show'} metadata`}<span>{item?.match ? extension : ''}</span>{inspecting && <em>Inspecting video &amp; audio…</em>}{probeState === 'error' && <em className="probe-error">Media details unavailable</em>}{blockingIssue && <em className="plan-error">{blockingIssue.message}</em>}</div></div>
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
                  <div className="row-trailing">
                    <div className="score"><strong>{blockingIssue ? '!' : deferredToTv ? 'TV' : item ? `${Math.round((item.match?.score ?? 0) * 100)}%` : '—'}</strong><small>{inspecting ? 'inspecting' : blockingIssue ? 'blocked' : deferredToTv ? 'deferred' : activeMediaTab === 'movies' ? movieFileMatch?.status ?? 'detecting' : confirmed ? 'confirmed' : status}</small></div>
                    <div className={`row-extras with-edit ${(activeMediaTab === 'movies' || !keepReviewActionsFixed) ? 'with-review' : ''}`}>
                      <button className="row-refresh" aria-label={`Refresh media information for ${filename}`} title="Refresh media information" disabled={inspecting} onClick={() => void inspectMedia([path])}><RefreshCw className={inspecting ? 'spin' : ''} size={14}/></button>
                      <button className="row-remove" aria-label={`Remove ${filename} from batch`} title="Remove from batch" disabled={removing} onClick={() => removeFileFromBatch(path)}><Trash2 size={14}/></button>
                      <button className="row-edit" aria-label={`Edit metadata for ${filename}`} title="Edit metadata" disabled={activeMediaTab === 'movies' ? !movieFileMatch?.movie : !item?.match || !show} onClick={() => openMetadataEditor(path)}><FilePenLine size={14}/></button>
                      {activeMediaTab === 'shows' && !keepReviewActionsFixed && <button className="row-review" aria-label={`Review episode match for ${filename}`} title="Review episode match" disabled={!item} onClick={() => openMatchReview(path)}><ListChecks size={14}/></button>}
                      {activeMediaTab === 'movies' && deferredToTv && <button className="row-open-tv" aria-label={`Open ${filename} in TV mode`} title="Open batch in TV mode" onClick={() => switchMediaTab('shows')}><Tv size={14}/></button>}
                      {activeMediaTab === 'movies' && !deferredToTv && <button className={`row-review ${movieReviewRequired ? 'required' : ''}`} aria-label={`Match movie for ${filename}`} title="Match movie" disabled={!movieFileMatch || movieFileMatch.status === 'detecting'} onClick={() => openMovieMatchReview(path)}><ListChecks size={14}/></button>}
                    </div>
                    {(matchingRequired && item?.match) || movieConfirmationRequired ? <button className="row-confirm" aria-label={`Confirm suggested ${activeMediaTab === 'movies' ? 'movie' : 'episode'} match for ${filename}`} title="Confirm suggested match" onClick={() => confirmSuggestedMatch(path)}><Check size={14}/></button> : confirmationHeld ? <span className="row-confirm confirmed" aria-label={`Confirmed episode match for ${filename}`} title="Episode match confirmed"><Check size={14}/></span> : null}
                    {keepReviewActionsFixed && <button className={`row-review ${matchingRequired ? 'required' : ''}`} aria-label={`Review episode match for ${filename}`} title="Review episode match" disabled={!item} onClick={() => openMatchReview(path)}><ListChecks size={14}/></button>}
                  </div>
                </article></div></div>;
              })}
            </div>}
            {paths.length === 0 && <button className="dropzone dropzone-empty" onClick={addFiles}><FolderOpen size={30}/><span>Drop files or folders anywhere in this panel</span><small>or click to choose video files</small></button>}
            {paths.length > 0 && <div className="drop-target-overlay" aria-hidden="true"><FolderPlus size={30}/><strong>Add files or folders</strong><small>Drop anywhere in this panel</small></div>}
          </section>
        </section>
      </main>

      <footer><div><span className="legend confident"></span>{t('footer.ready', { count: preflightPlan.readyCount })} <span className="legend review"></span>{preflightError ? 'preflight failed' : t('footer.blocked', { count: preflightPlan.blockedCount })} <span className="tmdb-attribution">{activeMediaTab === 'shows' ? 'Episode metadata by TheTVDB. ' : ''}This product uses the TMDB API but is not endorsed or certified by TMDB.</span></div><div>{lastRename && ['completed', 'stopped'].includes(lastRename.operation.status) && <button className="secondary" disabled={renaming || undoing} onClick={() => setUndoConfirmationOpen(true)}>{undoing ? <LoaderCircle className="spin" size={15}/> : <RotateCcw size={15}/>} {t('footer.undo')}</button>}<button className="secondary" disabled={!paths.length || checkingPlan || Boolean(preflightError) || renaming || undoing} onClick={() => void exportPlan()}>{t('footer.export')}</button><button className="primary" title={checkingPlan ? 'Waiting for the filesystem collision check' : preflightError ? 'Retry the failed preflight check before renaming' : undefined} disabled={!executableGroups.length || preflightPlan.blockedCount > 0 || checkingPlan || Boolean(preflightError) || renaming || undoing} onClick={() => setRenameConfirmationOpen(true)}>{renaming ? <LoaderCircle className="spin" size={16}/> : null} {t('footer.rename', { count: preflightPlan.readyCount })} <ChevronRight size={16}/></button></div></footer>

      {posterPreviewOpen && activeTitle?.posterUrl && <div className="poster-preview-layer">
        <button className="poster-preview-backdrop" aria-label="Close poster preview" onClick={() => { setPosterPreviewOpen(false); setPosterZoomed(false); }}/>
        <section ref={posterPreviewDialog} className={`poster-preview-dialog ${posterZoomed && posterCanZoom ? 'zoomed' : ''}`} role="dialog" aria-modal="true" aria-label={`${activeTitle.name}${activeTitle.year ? ` (${activeTitle.year})` : ''} poster`}>
          <button className="poster-preview-image" disabled={!posterCanZoom} aria-label={posterCanZoom ? posterZoomed ? 'Fit poster to window' : 'View poster at full size' : undefined} aria-pressed={posterCanZoom ? posterZoomed : undefined} title={posterCanZoom ? posterZoomed ? 'Fit to window' : 'View at 100%' : undefined} onClick={() => { if (posterCanZoom) setPosterZoomed((zoomed) => !zoomed); }}><img ref={posterPreviewImage} src={fullSizeArtworkUrl(activeTitle.posterUrl)} alt={`${activeTitle.name}${activeTitle.year ? ` (${activeTitle.year})` : ''} poster`} onLoad={() => { updatePosterZoomAvailability(); if (posterZoomed) centerPosterPreview(); }}/></button>
        </section>
        <button className="poster-preview-close" aria-label="Close poster preview" title="Close" autoFocus onClick={() => { setPosterPreviewOpen(false); setPosterZoomed(false); }}><X size={20}/></button>
      </div>}

      {editingMetadataPath && metadataDraft && <div className="confirmation-layer metadata-editor-layer" role="presentation">
        <button className="confirmation-backdrop" aria-label="Cancel metadata editing" onClick={() => { setEditingMetadataPath(undefined); setMetadataDraft(undefined); }}/>
        <form className="metadata-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="metadata-editor-title" onSubmit={(event) => { event.preventDefault(); saveMetadataEditor(); }}>
          <div className="metadata-editor-heading"><div><p className="eyebrow">EDIT METADATA</p><h2 id="metadata-editor-title">{filenameFromPath(editingMetadataPath)}</h2></div><button type="button" className="icon-button" aria-label="Close metadata editor" onClick={() => { setEditingMetadataPath(undefined); setMetadataDraft(undefined); }}><X size={18}/></button></div>
          <div className="metadata-editor-body">
            <section><h3>{activeMediaTab === 'movies' ? 'Movie' : 'Show'}</h3><div className="metadata-field-grid">
              <label className="wide"><span>Title</span><input autoFocus value={metadataDraft.name} onChange={(event) => setMetadataDraft({ ...metadataDraft, name: event.target.value })}/></label>
              <label><span>Year</span><input inputMode="numeric" placeholder="Optional" value={metadataDraft.year} onChange={(event) => setMetadataDraft({ ...metadataDraft, year: event.target.value })}/></label>
              <label><span>{activeMediaTab === 'movies' ? 'TMDB ID' : 'TVDB ID'}</span><input inputMode="numeric" placeholder="Optional" value={metadataDraft.providerId} onChange={(event) => setMetadataDraft({ ...metadataDraft, providerId: event.target.value })}/></label>
            </div></section>
            {activeMediaTab === 'shows' && <section><h3>Episode metadata</h3><div className="metadata-episodes">{metadataDraft.episodes.map((episode, index) => <div className="metadata-episode" key={episode.id}><strong>Episode {index + 1}</strong><label><span>Season</span><input inputMode="numeric" value={episode.season} onChange={(event) => setMetadataDraft({ ...metadataDraft, episodes: metadataDraft.episodes.map((item) => item.id === episode.id ? { ...item, season: event.target.value } : item) })}/></label><label><span>Number</span><input inputMode="numeric" value={episode.number} onChange={(event) => setMetadataDraft({ ...metadataDraft, episodes: metadataDraft.episodes.map((item) => item.id === episode.id ? { ...item, number: event.target.value } : item) })}/></label><label className="episode-title"><span>Title</span><input value={episode.title} onChange={(event) => setMetadataDraft({ ...metadataDraft, episodes: metadataDraft.episodes.map((item) => item.id === episode.id ? { ...item, title: event.target.value } : item) })}/></label></div>)}</div></section>}
            <section><h3>Release metadata</h3><div className="metadata-field-grid release-fields">
              <label className="wide"><span>Edition</span><input placeholder="Optional" value={metadataDraft.edition} onChange={(event) => setMetadataDraft({ ...metadataDraft, edition: event.target.value })}/></label>
              <label><span>Resolution</span><input placeholder="1080p" value={metadataDraft.resolution} onChange={(event) => setMetadataDraft({ ...metadataDraft, resolution: event.target.value })}/></label>
              <label><span>Source</span><select value={metadataDraft.source} onChange={(event) => setMetadataDraft({ ...metadataDraft, source: event.target.value as Source })}><option value="Unknown">Unknown</option>{SOURCE_OPTIONS.map((source) => <option value={source} key={source}>{source}</option>)}</select></label>
              <label><span>Video codec</span><input placeholder="H.264" value={metadataDraft.videoCodec} onChange={(event) => setMetadataDraft({ ...metadataDraft, videoCodec: event.target.value })}/></label>
              <label><span>Audio codec</span><input placeholder="AAC" value={metadataDraft.audioCodec} onChange={(event) => setMetadataDraft({ ...metadataDraft, audioCodec: event.target.value })}/></label>
              <label><span>Channels</span><input placeholder="2.0" value={metadataDraft.channels} onChange={(event) => setMetadataDraft({ ...metadataDraft, channels: event.target.value })}/></label>
              <label><span>Web origin</span><input placeholder="Netflix" value={metadataDraft.webOrigin} onChange={(event) => setMetadataDraft({ ...metadataDraft, webOrigin: event.target.value })}/></label>
              <label><span>Origin shorthand</span><input placeholder="NF" value={metadataDraft.webOriginShort} onChange={(event) => setMetadataDraft({ ...metadataDraft, webOriginShort: event.target.value })}/></label>
              <label><span>Release group</span><input placeholder="QxR" value={metadataDraft.group} onChange={(event) => setMetadataDraft({ ...metadataDraft, group: event.target.value })}/></label>
              <label className="wide"><span>Flags</span><input placeholder="Comma-separated" value={metadataDraft.flags} onChange={(event) => setMetadataDraft({ ...metadataDraft, flags: event.target.value })}/></label>
            </div></section>
            <section className={`metadata-live-preview ${metadataDraftError ? 'invalid' : ''}`}><h3>Filename preview</h3><code>{metadataDraftError ?? metadataDraftPreview ?? 'The active filename template is invalid.'}</code></section>
          </div>
          <div className="metadata-editor-actions">{metadataOverrides[editingMetadataPath] && <button type="button" className="secondary" onClick={() => { setMetadataOverrides((current) => Object.fromEntries(Object.entries(current).filter(([path]) => path !== editingMetadataPath))); setEditingMetadataPath(undefined); setMetadataDraft(undefined); }}>Reset to detected</button>}<span/><button type="button" className="secondary" onClick={() => { setEditingMetadataPath(undefined); setMetadataDraft(undefined); }}>Cancel</button><button className="primary" disabled={Boolean(metadataDraftError)}><FilePenLine size={15}/> Save metadata</button></div>
        </form>
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
        <section className="confirmation-dialog match-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-all-title" aria-describedby="confirm-all-description">
          <span className="confirmation-icon"><FileCheck2 size={20}/></span>
          <h2 id="confirm-all-title">{confirmAllResult ? `${confirmAllResult.confirmed} match${confirmAllResult.confirmed === 1 ? '' : 'es'} confirmed` : `Review ${confirmationActionCount} matching decision${confirmationActionCount === 1 ? '' : 's'}`}</h2>
          <p id="confirm-all-description">{confirmationSuggestions.length ? `${confirmationSuggestions.length} suggested ${activeMediaTab === 'movies' ? 'movie' : 'episode'} match${confirmationSuggestions.length === 1 ? ' is' : 'es are'} ready to accept.` : 'There are no remaining suggestions that can be accepted automatically.'}{confirmationBlockers.length ? ` ${confirmationBlockers.length} file${confirmationBlockers.length === 1 ? '' : 's'} still require manual attention.` : ''}</p>
          <div className="match-confirmation-groups">
            {confirmationSuggestions.length > 0 && <section><h3>Suggested matches</h3><ul className="confirmation-results actionable">{confirmationSuggestions.map((item) => <li key={item.path}><span><strong>{filenameFromPath(item.path)}</strong><small>{item.label}</small></span><button className="secondary" onClick={() => { setConfirmAllResult(undefined); confirmSuggestedMatch(item.path); }}><Check size={13}/> Accept</button></li>)}</ul></section>}
            {confirmationBlockers.length > 0 && <section><h3>Needs manual attention</h3><ul className="confirmation-results actionable">{confirmationBlockers.map((item) => {
              const canReview = activeMediaTab === 'movies'
                ? Boolean(movieMatches[item.path] && movieMatches[item.path].status !== 'detecting' && !deferredMoviePaths.has(item.path))
                : Boolean(show && episodes.length && matchesByPath.get(item.path));
              return <li key={item.path}><span><strong>{filenameFromPath(item.path)}</strong><small>{item.reason}</small></span><button className="secondary" disabled={!canReview} title={canReview ? `Choose a ${activeMediaTab === 'movies' ? 'movie' : 'TV episode'} match` : activeMediaTab === 'movies' && deferredMoviePaths.has(item.path) ? 'Open this file in TV mode from its row.' : 'Load show metadata before choosing an episode.'} onClick={() => reviewFromConfirmation(item.path)}><ListChecks size={13}/> Review</button></li>;
            })}</ul></section>}
          </div>
          <div><button className="secondary" autoFocus onClick={() => setConfirmAllOpen(false)}>{confirmAllResult ? 'Done' : 'Close'}</button>{confirmationSuggestions.length > 0 && <button className="primary" onClick={confirmAllSuggestedMatches}><Check size={15}/> Accept all {confirmationSuggestions.length}</button>}</div>
        </section>
      </div>}

      {renameConfirmationOpen && <div className="confirmation-layer" role="presentation">
        <button className="confirmation-backdrop" aria-label="Cancel rename" disabled={renaming} onClick={() => setRenameConfirmationOpen(false)}/>
        <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="rename-title" aria-describedby="rename-description">
          <span className="confirmation-icon"><FileCheck2 size={20}/></span>
          <h2 id="rename-title">Rename {executableGroups.length} {activeMediaTab === 'movies' ? 'movie' : 'episode'}{executableGroups.length === 1 ? '' : 's'}?</h2>
          <p id="rename-description">This will rename or move {executableFileCount} file{executableFileCount === 1 ? '' : 's'}, including companion files. Existing destinations are automatically given an increment such as <code>(2)</code>, and the complete operation is logged for undo.{moveFiles && removeEmptySourceParents ? ' Empty immediate source folders will be removed after the move.' : ''}</p>
          {renaming && work && <div className="rename-progress-details" role="status" aria-live="polite">
            <div className="rename-progress-heading"><strong>{work.operation === 'Undoing' ? 'Undoing completed renames' : renameControl === 'stop' ? 'Stopping after the current file' : renameControl === 'undo' ? 'Stopping and restoring files' : `Renaming ${renameCompleted} of ${renameTotal} files`}</strong><span>{renamePercent}%</span></div>
            <SmoothProgress className="rename-progress" value={renameCompleted} max={renameTotal}/>
            <div className="rename-time-grid">
              <span><small>Elapsed</small><strong>{formatDuration(renameElapsed)}</strong></span>
              <span><small>Estimated total</small><strong>{work.operation === 'Undoing' ? '—' : estimatedRenameTotal === undefined ? 'Calculating…' : formatDuration(estimatedRenameTotal)}</strong></span>
              <span><small>Remaining</small><strong>{work.operation === 'Undoing' ? '—' : estimatedRenameRemaining === undefined ? 'Calculating…' : formatDuration(estimatedRenameRemaining)}</strong></span>
            </div>
          </div>}
          <div className="rename-dialog-actions">{renaming ? <><button className="primary destructive" disabled={Boolean(renameControl)} onClick={() => void controlActiveRename('undo')}><RotateCcw size={15}/> {renameControl === 'undo' ? 'Undo requested' : 'Undo'}</button><button className="secondary" disabled={Boolean(renameControl)} onClick={() => void controlActiveRename('stop')}><Square size={14}/> {renameControl === 'stop' ? 'Stopping…' : 'Stop'}</button></> : <><button className="secondary" autoFocus onClick={() => setRenameConfirmationOpen(false)}>Cancel</button><button className="primary" onClick={() => void executeRenames()}><FileCheck2 size={15}/> Rename files</button></>}</div>
        </section>
      </div>}

      {renameReport && reportOperation && <div className="confirmation-layer" role="presentation">
        <button className="confirmation-backdrop" aria-label="Close rename report" onClick={() => setRenameReport(undefined)}/>
        <section className={`confirmation-dialog rename-report ${reportOperation.status === 'completed' ? '' : 'warning'}`} role="dialog" aria-modal="true" aria-labelledby="rename-report-title" aria-describedby="rename-report-description">
          <span className="confirmation-icon">{reportOperation.status === 'completed' ? <Check size={20}/> : reportOperation.status === 'undone' ? <RotateCcw size={20}/> : <Square size={18}/>}</span>
          <h2 id="rename-report-title">{reportOperation.status === 'completed' ? 'Rename complete' : reportOperation.status === 'undone' ? 'Rename undone' : 'Rename stopped'}</h2>
          <p id="rename-report-description">{reportOperation.status === 'completed' ? `${reportOperation.items.length} file${reportOperation.items.length === 1 ? '' : 's'} ${renameReport.moved ? 'moved and renamed' : 'renamed'} successfully.` : reportOperation.status === 'undone' ? `${reportOperation.items.length} completed file operation${reportOperation.items.length === 1 ? ' was' : 's were'} restored.` : `${reportOperation.items.length} file${reportOperation.items.length === 1 ? '' : 's'} completed before the operation stopped.`}</p>
          <div className="rename-report-grid">
            <span><strong>{reportOperation.items.length}</strong><small>Files processed</small></span>
            <span><strong>{reportOperation.removedSourceJunkFiles?.length ?? 0}</strong><small>Junk files cleared</small></span>
            <span><strong>{reportOperation.removedSourceDirectories?.length ?? 0}</strong><small>Folders removed</small></span>
            <span className={reportWarnings ? 'has-warnings' : ''}><strong>{reportWarnings}</strong><small>Warnings</small></span>
          </div>
          <div className="rename-report-notes">
            <span><RotateCcw size={14}/><span><strong>{reportOperation.status === 'undone' ? 'Original paths restored' : 'Undo is available'}</strong><small>{renameReport.result.logPath}</small></span></span>
            {reportOperation.externalLogPath && <span><FileText size={14}/><span><strong>Operation log saved</strong><small>{reportOperation.externalLogPath}</small></span></span>}
            {reportWarnings > 0 && <span className="warning"><TriangleAlert size={14}/><span><strong>{reportWarnings} warning{reportWarnings === 1 ? '' : 's'} recorded</strong><small>Open the debug console for details.</small></span></span>}
          </div>
          <div><button className="primary" autoFocus onClick={() => setRenameReport(undefined)}>Done</button></div>
        </section>
      </div>}

      {undoConfirmationOpen && lastRename && ['completed', 'stopped'].includes(lastRename.operation.status) && <div className="confirmation-layer" role="presentation">
        <button className="confirmation-backdrop" aria-label="Cancel undo" onClick={() => setUndoConfirmationOpen(false)}/>
        <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="undo-title" aria-describedby="undo-description">
          <span className="confirmation-icon"><RotateCcw size={20}/></span>
          <h2 id="undo-title">Undo the last rename?</h2>
          <p id="undo-description">This will safely move {lastRename.operation.items.length} file{lastRename.operation.items.length === 1 ? '' : 's'} back to their original locations. Undo stops if an original path is now occupied.</p>
          <div><button className="secondary" disabled={undoing} onClick={() => setUndoConfirmationOpen(false)}>Cancel</button><button className="primary" disabled={undoing} onClick={() => void undoLastRename()}>{undoing && <LoaderCircle className="spin" size={15}/>} Undo rename</button></div>
        </section>
      </div>}

      {movieReviewPath && <div className="review-layer">
        <button className="review-backdrop" aria-label="Close movie match" onClick={() => setMovieReviewPath(undefined)}/>
        <aside className="review-panel movie-review-panel" aria-label="Match movie">
          <div className="review-heading"><div><p className="eyebrow">MOVIE MATCH</p><h2>Choose a movie</h2></div><button className="icon-button" aria-label="Close movie match" onClick={() => setMovieReviewPath(undefined)}><X size={18}/></button></div>
          <div className="review-file"><FileVideo size={17}/><span><strong>{filenameFromPath(movieReviewPath)}</strong><small>Search TMDB and choose the exact title and release year.</small></span></div>
          <label className="review-search"><Search size={15}/><input value={movieReviewQuery} onChange={(event) => { setMovieReviewQuery(event.target.value); setMovieReviewSelection(undefined); }} placeholder="Movie title, year, or tmdb-…" autoFocus/>{movieReviewSearching && <LoaderCircle className="spin" size={14}/>}</label>
          <div className="review-results-heading"><strong>Search results</strong><small>{movieReviewResults.length} movie{movieReviewResults.length === 1 ? '' : 's'}</small></div>
          <div className="movie-review-candidates" role="listbox" aria-label="Movie search results">
            {movieReviewResults.map((movie) => <button key={movie.id} role="option" aria-selected={movieReviewSelection === movie.id} className={movieReviewSelection === movie.id ? 'selected' : ''} onClick={() => setMovieReviewSelection(movie.id)} onDoubleClick={() => void confirmMovieReview(movie.id)}>
              {movie.posterUrl ? <img src={movie.posterUrl} alt=""/> : <span className="movie-review-poster-placeholder"><Film size={19}/></span>}
              <span><strong>{movie.name}</strong><small>{movie.year ?? 'Release year unknown'} · TMDB {movie.id}</small>{movie.overview && <em>{movie.overview}</em>}</span>
              {movieReviewSelection === movie.id && <Check size={16}/>}
            </button>)}
            {!movieReviewSearching && !movieReviewResults.length && <div className="review-empty">No movies found. Refine the title or add a release year.</div>}
          </div>
          {movieReviewError && <div className="movie-review-error"><AlertCircle size={14}/>{movieReviewError}</div>}
          <div className="review-footer"><span><FileCheck2 size={15}/> Double-click a result to confirm it immediately.</span><button className="primary" disabled={!movieReviewSelection || movieReviewSearching || movieReviewLoading} onClick={() => void confirmMovieReview()}>{movieReviewLoading && <LoaderCircle className="spin" size={14}/>} Confirm movie</button></div>
        </aside>
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
              const selected = reviewCandidate ? candidateKey(reviewCandidate) === candidateKey(candidate) : false;
              const manual = candidate.reasons.includes('manually selected');
              return <button key={candidateKey(candidate)} className={selected ? 'selected' : ''} title="Double-click to confirm this episode" onClick={() => setReviewCandidate(candidate)} onDoubleClick={() => confirmMatchReview(candidate)}>
                <span className="candidate-code">{candidateLabel(candidate)}</span>
                <span><strong>{candidateTitle(candidate)}</strong><small>{manual ? 'Manual selection' : candidate.reasons.join(' · ') || 'No matching evidence'}</small></span>
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
        <button className="preferences-backdrop" aria-label={t('prefs.close')} onClick={() => { setPreferencesOpen(false); setTemplateReferenceOpen(false); }}/>
        {templateReferenceOpen && <TemplateReferencePanel tab={preferenceMediaTab} onClose={() => setTemplateReferenceOpen(false)}/>}
        <aside className="preferences-panel" aria-label={t('prefs.title')}>
          <div className="preferences-heading"><div><p className="eyebrow">{t('prefs.settings')}</p><h2>{t('prefs.title')}</h2></div><button className="icon-button" aria-label={t('prefs.close')} onClick={() => { setPreferencesOpen(false); setTemplateReferenceOpen(false); }}><X size={18}/></button></div>
          <section className="preference-section language-settings"><h3>{t('prefs.language')}</h3><p>{t('prefs.languageHelp')}</p><label><span>{t('prefs.systemLanguage')}</span><select value={languagePreference} onChange={(event) => setLanguagePreference(event.target.value as LanguagePreference)}>{LANGUAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.value === 'system' ? `${t('common.automatic')} — ${LANGUAGE_OPTIONS.find((candidate) => candidate.value === language)?.label ?? 'English'}` : option.label}</option>)}</select></label></section>
          <section className="preference-section"><h3>{t('prefs.appearance')}</h3><p>{t('prefs.appearanceHelp')}</p><div className="theme-switcher" role="group" aria-label="Light and dark appearance">
            {([['system', Monitor, t('common.automatic')], ['light', Sun, t('common.light')], ['dark', Moon, t('common.dark')]] as const).map(([value, Icon, label]) => (
              <button key={value} className={preference === value ? 'active' : ''} aria-label={`${label} appearance`} aria-pressed={preference === value} onClick={() => setPreference(value)}><Icon size={15}/><span>{label}</span></button>
            ))}
          </div><div className="palette-heading"><strong>{t('prefs.colourTheme')}</strong><small>{t('prefs.colourHelp')}</small></div><div className="palette-switcher" role="group" aria-label="Colour theme">
            {([['classic', 'Classic', '#7663dc'], ['ocean', 'Ocean', '#1688c9'], ['forest', 'Forest', '#27865b'], ['rose', 'Rose', '#c04f82'], ['amber', 'Amber', '#c47a16'], ['halloween', 'Halloween', '#e56b18'], ['christmas', 'Christmas', '#4f8fc9']] as Array<[ThemePalette, string, string]>).filter(([value]) => selectablePalettes.includes(value)).map(([value, label, colour]) => (
              <button key={value} className={`${palette === value ? 'active' : ''} ${value === 'halloween' || value === 'christmas' ? 'seasonal' : ''}`.trim()} aria-pressed={palette === value} onClick={() => setPalette(value)}><span className="palette-swatch" style={{ '--palette-swatch': colour } as CSSProperties}/><span>{label}</span>{(value === 'halloween' || value === 'christmas') && <small>Seasonal</small>}</button>
            ))}
          </div></section>
          <section className="preference-section"><h3>{t('prefs.fileList')}</h3><p>{t('prefs.fileListHelp')}</p><div className="view-mode-switcher" role="group" aria-label="File list view">
            {([['detailed', 'Detailed', 'Match evidence and detected media tags'], ['summary', 'Summary', 'Current filename and proposed filename'], ['compact', 'Compact', 'Short rows for larger batches']] as const).map(([value, label, description]) => (
              <button key={value} className={fileViewMode === value ? 'active' : ''} aria-pressed={fileViewMode === value} onClick={() => setFileViewMode(value)}><strong>{label}</strong><small>{description}</small></button>
            ))}
          </div></section>
          <section className={`preference-section release-alias-settings ${parsedReleaseAliases.errors.length ? 'invalid' : ''}`}><h3>Release-tag aliases</h3><p>Add personal filename vocabulary without replacing the built-in detector. Matches are case-insensitive, separator-tolerant, and require complete tokens.</p><label><span><strong>Aliases</strong><small><code>field = filename alias =&gt; output</code>; web origins may add <code>| shorthand</code>.</small></span><textarea value={releaseAliasText} onChange={(event) => setReleaseAliasText(event.target.value)} spellCheck={false} placeholder={'source = web download => WEB-DL\nvideoCodec = AVC => H.264\nflag = dual audio => Dual Audio\nwebOrigin = crunchy premium => Crunchyroll | CR'}/></label><small className="release-alias-fields">Fields: <code>source</code> <code>resolution</code> <code>videoCodec</code> <code>audioCodec</code> <code>channels</code> <code>flag</code> <code>webOrigin</code></small>{parsedReleaseAliases.errors.length ? <ul className="release-alias-errors">{parsedReleaseAliases.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <div className="release-alias-status"><Check size={13}/>{parsedReleaseAliases.aliases.length ? `${parsedReleaseAliases.aliases.length} custom alias${parsedReleaseAliases.aliases.length === 1 ? '' : 'es'} active` : 'Built-in vocabulary only'}</div>}{releaseAliasText && <button className="clear-overrides" onClick={() => setReleaseAliasText('')}>Clear custom aliases</button>}</section>
          <section className="preference-section"><h3>{t('prefs.fileMoves')}</h3><p>{t('prefs.fileMovesHelp')}</p><label className="preference-toggle"><span><Trash2 size={17}/><span><strong>{t('prefs.clearJunk')}</strong><small>{t('prefs.clearJunkHelp')}</small></span></span><input type="checkbox" checked={clearSourceJunk} onChange={(event) => setClearSourceJunk(event.target.checked)}/></label><label className="preference-toggle"><span><FolderTree size={17}/><span><strong>{t('prefs.removeEmpty')}</strong><small>{t('prefs.removeEmptyHelp')}</small></span></span><input type="checkbox" checked={removeEmptySourceParents} onChange={(event) => setRemoveEmptySourceParents(event.target.checked)}/></label></section>
          <section className="preference-section after-rename-settings"><h3>{t('prefs.afterRename')}</h3><p>{t('prefs.afterRenameHelp')}</p>
            <label className="preference-toggle"><span><Trash2 size={17}/><span><strong>{t('prefs.autoClear')}</strong><small>{t('prefs.autoClearHelp')}</small></span></span><input type="checkbox" checked={autoClearCompletedBatch} onChange={(event) => setAutoClearCompletedBatch(event.target.checked)}/></label>
            <label className="preference-toggle"><span><BellRing size={17}/><span><strong>{t('prefs.completionChime')}</strong><small>{t('prefs.completionChimeHelp')}</small></span></span><input type="checkbox" checked={completionChime} onChange={(event) => setCompletionChimeEnabled(event.target.checked)}/></label>
            <label className="preference-toggle"><span><ListChecks size={17}/><span><strong>{t('prefs.completionReport')}</strong><small>{t('prefs.completionReportHelp')}</small></span></span><input type="checkbox" checked={completionReport} onChange={(event) => setCompletionReport(event.target.checked)}/></label>
            <label className="preference-toggle"><span><FileText size={17}/><span><strong>{t('prefs.saveLog')}</strong><small>{t('prefs.saveLogHelp')}</small></span></span><input type="checkbox" checked={createExternalRenameLog} onChange={(event) => setCreateExternalRenameLog(event.target.checked)}/></label>
            {createExternalRenameLog && <div className="destination-row standalone"><span><strong>Operation log folder</strong><small>{renameLogFolder || 'Use the active TV or Movie destination; otherwise use the renamed files’ common folder'}</small></span><span className="destination-actions"><button className="secondary" onClick={() => void chooseBaseFolder('Log')}><FolderTree size={14}/>{renameLogFolder ? 'Change' : 'Choose'}</button>{renameLogFolder && <button className="icon-button" aria-label="Clear operation log folder" title="Use the active media destination" onClick={() => setRenameLogFolder('')}><X size={14}/></button>}</span></div>}
          </section>
          <div className="preference-media-tabs" role="tablist" aria-label="Media settings">
            <button role="tab" aria-selected={preferenceMediaTab === 'shows'} className={preferenceMediaTab === 'shows' ? 'active' : ''} onClick={() => setPreferenceMediaTab('shows')}><Tv size={15}/> {t('prefs.shows')}</button>
            <button role="tab" aria-selected={preferenceMediaTab === 'movies'} className={preferenceMediaTab === 'movies' ? 'active' : ''} onClick={() => setPreferenceMediaTab('movies')}><Film size={15}/> {t('prefs.movies')}</button>
          </div>
          {preferenceMediaTab === 'shows' ? <div className="preference-media-panel" role="tabpanel" aria-label="Shows settings">
            <section className="preference-section"><h3>Metadata agent</h3><p>Provider switching will be available when additional agents are ready.</p><div className="metadata-overrides"><label><span><strong>Show episodes</strong><small>TVDB Aired supplies Plex-oriented episode numbering and titles. Search and artwork continue to use TMDB.</small></span><select value="tvdb-aired" disabled aria-label="Show metadata agent"><option value="tvdb-aired">TVDB Aired</option></select></label></div></section>
            <section className="preference-section"><h3>Episode matching</h3><label className="preference-toggle"><span><Sparkles size={17}/><span><strong>Match episode names</strong><small>Best effort when numbering and titles disagree</small></span></span><input type="checkbox" checked={titleMatching} onChange={(event) => { setTitleMatching(event.target.checked); addDebug('info', `Episode-title matching ${event.target.checked ? 'enabled' : 'disabled'}`); }}/></label><label className="confidence-threshold"><span><strong>Automatic confirmation</strong><small>Matches at or above this confidence are accepted without review.</small></span><output>{matchConfidenceThreshold}%</output><input type="range" min="50" max="100" step="1" value={matchConfidenceThreshold} aria-label="Automatic match confirmation threshold" aria-valuetext={`${matchConfidenceThreshold}% confidence`} onChange={(event) => setMatchConfidenceThreshold(Number(event.target.value))}/><span className="confidence-range"><small>50%</small><small>100%</small></span></label></section>
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
            <section className="preference-section"><h3>Metadata agent</h3><p>Provider switching will be available when additional agents are ready.</p><div className="metadata-overrides"><label><span><strong>Movies</strong><small>TMDB currently supplies movie search, artwork, and metadata.</small></span><select value="tmdb" disabled aria-label="Movie metadata agent"><option value="tmdb">TMDB</option></select></label></div></section>
            <section className={`preference-section destination-settings ${movieFolderFormatError ? 'invalid' : ''}`}><h3>Movie destination</h3><p>Configure the separate library destination that the movie workflow will use.</p>
              <div className="destination-row"><span><strong>Movie base folder</strong><small>{movieBaseFolder || 'Create the movie folder beside its source'}</small></span><span className="destination-actions"><button className="secondary" onClick={() => void chooseBaseFolder('Movie')}><FolderTree size={14}/>{movieBaseFolder ? 'Change' : 'Choose'}</button>{movieBaseFolder && <button className="icon-button" aria-label="Clear movie base folder" title="Create the movie folder beside its source" onClick={() => setMovieBaseFolder('')}><X size={14}/></button>}</span></div>
              <label className="folder-template-field"><span><strong>Movie folder pattern</strong><small>Supports movie.name, movie.year, movie.tmdbId, and nested folders.</small></span><input value={movieFolderTemplate} onChange={(event) => setMovieFolderTemplate(event.target.value)} spellCheck={false}/></label>
              {!movieFolderFormatError && <small className="format-help"><code>{'{{movie.name}}'}</code><code>{'{{movie.year}}'}</code><code>{'{{movie.edition}}'}</code><code>{'{{movie.tmdbId}}'}</code><button className={`reference-link ${templateReferenceOpen ? 'active' : ''}`} aria-expanded={templateReferenceOpen} onClick={() => setTemplateReferenceOpen((open) => !open)}>Reference</button></small>}
              {movieFolderFormatError ? <small className="format-error">{movieFolderFormatError}</small> : <div className="format-preview"><span>Output</span><strong>{joinPath(movieBaseFolder || 'Source folder', formatMovieFolder(movieFolderTemplate, 'Blade Runner: 2049', 2017, '335984'))}</strong></div>}
            </section>
            <section className={`preference-section format-editor ${movieFormatError ? 'invalid' : ''}`}>
              <div className="format-heading"><span><h3>Movie filename template</h3><p>Controls the filename produced by the movie workflow.</p></span><button onClick={() => setMovieTemplate(DEFAULT_MOVIE_TEMPLATE)} disabled={movieTemplate === DEFAULT_MOVIE_TEMPLATE}>Reset</button></div>
              <TemplateEditor value={movieTemplate} onChange={setMovieTemplate}/>
              {movieFormatError ? <small className="format-error">{movieFormatError}</small> : <small className="format-help"><code>{'{{movie.name}}'}</code> <code>{'{{movie.year}}'}</code> <code>{'{{movie.tmdbId}}'}</code> <code>{'{{release.edition}}'}</code> <code>{'{{technical}}'}</code> <code>{'{{release.audioCodec}}'}</code><button className={`reference-link ${templateReferenceOpen ? 'active' : ''}`} aria-expanded={templateReferenceOpen} onClick={() => setTemplateReferenceOpen((open) => !open)}>Reference</button></small>}
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
