# Media Renamer

A confidence-first desktop renamer for TV episodes and movies, designed as a modern replacement for Rename My TV Series with a shared metadata, formatting, and reversible-execution foundation.

![Early matching workspace](docs/mockup.svg)

## Product principles

- Preview everything; never rename silently.
- Combine episode numbers and title similarity instead of trusting either blindly.
- Make ambiguity visible with confidence scores and alternatives.
- Preserve useful release metadata such as source, resolution, codec, flags, and group.
- Keep metadata providers replaceable. TVDB and TMDB are adapters, not domain models.
- Build renames as a reversible plan with collision checks and an operation log.

## Current foundation

This first scaffold includes:

- an Electron + React + TypeScript desktop shell;
- native file/folder selection and recursive drag-and-drop import;
- immediate ordered display of every imported video, including pending and unmatched files;
- automatic show-name inference from imported episode filenames, including seasonless `Ep. 01` and `Episode 01` naming, plus movie title/year inference that removes common release metadata;
- per-file movie batch detection with bounded concurrent TMDB searches, confidence-based automatic acceptance, and row-level replacement search for ambiguous or unmatched titles;
- literal-first title-and-year search with a structured year fallback for parenthesized and bare trailing years;
- a durable local metadata cache for searches, show/movie details, and episode lists, with bounded retention, atomic writes, and stale-data fallback during provider outages;
- compact and separated episode-number matching, including `S01E02`, `S01 E02`, `S01-E02`, `S01.E02`, `1x02`, and `1 x 02`;
- optional best-effort episode-title matching, including number/title conflicts;
- confidence states (`confident`, `review`, and `unmatched`);
- parsing for BluRay (including standalone `BD` folder tags), WEB-DL, WEBRip, HDTV, DVDRip, TVRip, leading or trailing release groups, normalized web-service origins, and common flags, with `ffprobe` detection overriding filename guesses for resolution, video/audio codecs, and channels and contributing duration evidence to episode matching;
- FlexGet-aligned Plex edition handling: movie editions use a fixed canonical vocabulary with ordered multi-edition normalisation, while TV/anime preserve explicit arbitrary `{edition-…}` names and block malformed or conflicting markers;
- guarded refresh-all and hover-only per-file refresh actions for re-reading embedded media information;
- parent-folder detection for AI-upscaled releases plus current-batch source and AI-upscale overrides when the filesystem provides incomplete evidence;
- anime-style episode versions such as `S01E01v2` and `S05E10v3`, normalized to the `REPACK` flag;
- editable multiline, Mustache-style output-name templates that produce single-line names with live rename previews;
- portable, byte-safe output names that normalize Windows-forbidden characters and shorten episode titles when necessary while preserving the show name, technical tags, TVDB ID, and extension;
- a non-destructive rename plan with portable filename validation, duplicate-destination detection, live source/target filesystem checks, JSON export, smoothly animated elapsed and estimated progress, cooperative Stop/Undo controls, and a concise completion report;
- separate persisted TV and Movie library destinations and folder patterns, so each workflow can target its own base folder;
- durable Electron-level preference storage with automatic migration from renderer-local settings, so destinations and templates survive development origins, upgrades, and restarts;
- an optional TV base folder with a templated, Windows-safe show-folder path that rename execution can create before moving files;
- opt-in move preferences that clear a conservative allowlist of YTS/YIFY promotional junk after a successful move and remove empty source folders, while leaving unrecognized files untouched;
- post-rename preferences for automatically clearing fully completed batches, showing an optional completion report (on by default), playing an optional completion chime that sounds once when enabled (with distinct Halloween and Christmas sounds), and writing timestamped JSON operation logs to a chosen folder or the active media destination, while retaining the internal undo record;
- per-file match review with ranked suggestions, full episode search, manual selection, and explicit confirmation before preflight accepts uncertain matches;
- a persisted 50–100% automatic-confirmation threshold, defaulting to 80%;
- complete original/proposed filename inspection through hover, keyboard-focus, pinnable previews, and wrapped Detailed-mode rows;
- companion-file discovery and planning for subtitles, NFO metadata, and named episode artwork, including preserved language/role suffixes and ambiguity blocking;
- active-show poster and preferred English clear-logo artwork from TMDB when available;
- persistent light/dark/system appearance controls plus independent colour palettes with animated, reduced-motion-aware transitions; October unlocks cursor-warped Halloween webs and rare bat flocks, while December unlocks cursor-avoiding Christmas snow (development builds expose both for testing);
- automatic system-language detection with a persisted override for English, Spanish, French, German, Italian, Brazilian Portuguese, Japanese, Korean, and Simplified Chinese;
- background-worker matching with visible per-file progress;
- lightweight monitoring of imported files so external deletes leave the batch and resolvable renames or moves update the tracked path;
- a resizable debug console that docks left, right, or bottom, or pops into an independent window, while explaining provider activity, imports, and accepted, review, or rejected match decisions; and
- automated coverage for matching, formatting, metadata providers and caching, file monitoring, preflight, rename execution, rollback, and undo.

The UI uses TMDB for search, artwork, movies, and show cross-references. TV shows use TVDB's English aired-order episode numbers and titles for Plex-oriented sorting. Disabled metadata-agent selectors in each Preferences tab reserve the provider boundary for future alternatives.

## Run it

Requires a current Node.js release and `ffprobe` on `PATH` (installed with FFmpeg). Set `FFPROBE_PATH` when the executable lives elsewhere.

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev:electron` is also available as an explicit alias for the complete desktop development stack. Both commands compile the Electron main/preload code, start Vite, and launch the app. Changes under `electron/` automatically recompile and restart Electron so the renderer and preload bridge cannot drift out of sync.

Add a TMDB v4 API Read Access Token and TVDB v4 API key to `.env` before starting the app:

```dotenv
TMDB_ACCESS_TOKEN=your_long_read_access_token_here
TVDB_API_KEY=your_tvdb_v4_api_key_here
# Only required for subscriber-supported TVDB keys:
TVDB_SUBSCRIBER_PIN=
```

Create or retrieve the token under your TMDB account's **Settings → API** page. Do not add a `Bearer ` prefix. The token is read only by Electron's main process and is not exposed to the renderer. `.env` is ignored by Git.

Search accepts show names, TMDB IDs such as `tmdb-1396`, and TVDB IDs such as `tvdb-482771`. TVDB IDs are resolved to the corresponding TMDB record for artwork and show details, while episode numbering and names come directly from TVDB.

This product uses the TMDB API but is not endorsed or certified by TMDB.

## Local metadata cache

Normalized provider results are cached in Electron's per-user application-data directory. Search results remain fresh for 6 hours, show and movie details for 7 days, and episode lists for 30 days. Entries are shared across restarts, concurrent requests for the same key are coalesced, and the cache is capped at 1,500 entries.

Cache files are written through a flushed temporary file and atomically published, so a crash cannot leave a partially written cache as the active copy. If a provider is temporarily unavailable, an expired cached value can still be used as a fallback. Corrupt or unreadable cache data is discarded without preventing live provider requests.

Run all current checks:

```bash
npm run check
```

## Matching model

Every imported file is ranked against the selected show's episodes. Evidence is additive:

1. Extract explicit season/episode numbers.
2. Normalize filename and episode titles (case, punctuation, diacritics, stop words, and release noise).
3. Score title coverage with a high recall bias because filenames contain extra show and release tokens.
4. Add a small positive score when the `ffprobe` container duration agrees with the provider's episode runtime; duration never creates a match by itself or penalizes a mismatch.
5. Surface contradictions—such as `S02E07` containing the exact title of episode 8—as review items instead of hiding the decision.
6. Automatically accept matches at or above the configured confidence threshold (80% by default), and require confirmation below it.

Future matching evidence can include air date, embedded title, and adjacent-file ordering. Provider ordering is metadata, not ground truth.

## Filename templates

Episode names use a Mustache-style template that can be laid out and indented like a script while always producing a single-line filename. After rendering, every run of whitespace becomes one space and leading or trailing whitespace is removed. Other text outside `{{…}}` is literal, so brackets and parentheses need no escaping. `{{#value}}…{{/value}}` includes optional content when a value exists; an `episodes` section repeats for every episode in a merged file. The built-in format is:

```text
{{show.name}}{{#show.year}} ({{show.year}}){{/show.year}} -
  {{episode.range}} -
  {{#episodes}}{{^first}}, {{/first}}{{title}}{{/episodes}}{{#technical}} [{{technical}}]{{/technical}}{{#show.tvdbId}} {tvdb-{{show.tvdbId}}}{{/show.tvdbId}}
```

The syntax-highlighted editor lives in the right-side Preferences drawer, shows a two-episode output immediately, and reports incomplete, mismatched, or unknown tags without breaking rename previews. A collapsible reference alongside it documents every available variable and the variable, section, and inverted-section syntax. Templates are retained locally between launches. The default appends the show's canonical TVDB ID as `{tvdb-74550}` when TMDB supplies that cross-reference. Release templates can use `{{release.group}}`, the normalized full web origin through `{{release.webOrigin}}`, or its canonical shorthand through `{{release.webOriginShort}}`.

The main batch toolbar includes a `Move files` / `In place` control. Moving uses the configured TV destination and show-folder template; in-place mode renames each video and its companion files inside their current directories. This is intentionally a current-batch flag and resets when the batch is cleared.

## Review and file tracking

Matches below the configured automatic-confirmation threshold remain blocked until they are confirmed or changed. The batch-level confirmation action accepts every currently suggested review match, while an individual tick accepts only its row. After clicking an individual tick, it remains beneath the pointer until the pointer leaves that row; later hovers use the compact Refresh, Remove, and manual-review tray. Double-clicking an episode in the manual matcher confirms it immediately.

Imported videos are monitored with native filesystem events. A deleted source disappears from the batch automatically. A file renamed in a watched directory, moved between watched batch directories, or moved into a child directory is followed by filesystem identity so its match and detected metadata remain attached to the new path. Monitoring pauses around Media Renamer's own rename and undo operations to avoid treating intentional moves as external deletions.

## Safe rename, move, and undo

Before execution, the complete plan validates source files, portable destination names, and occupied targets. Duplicate destinations are numbered as a group (`Name.mkv`, `Name (2).mkv`, and so on), keeping companion filenames aligned with their video. Destination publication never overwrites an existing file: same-filesystem operations publish through a hard link before removing the source, while cross-filesystem moves copy to a temporary file before publishing.

The rename dialog reports percentage complete, elapsed time, estimated total time, and estimated remaining time. `Stop` completes the current filesystem operation and records the finished subset as an undoable partial batch. The danger-coloured `Undo` control stops further work and immediately restores everything already completed.

Every operation is stored as a durable JSON record in Electron's application-data directory, with an optional timestamped copy in the configured log folder or active destination. Plan errors roll completed work back. Undo first verifies every source and destination, performs the reverse transaction, and atomically updates its log; if that log update fails, restored files are returned to their renamed locations so disk state and durable history cannot disagree.

## Delivery plan

| Milestone | Status | Progress |
| --- | --- | --- |
| 1 — TV matching foundation | Complete | 10 of 10 steps |
| 2 — Safe execution and desktop workflow | Complete | 12 of 12 steps |
| 3 — Resilient matching and metadata | In progress | 7 of 11 steps |
| 4 — Movies and library workflows | Started | 2 of 6 steps |
| 5 — Release readiness | Planned | 0 of 6 steps |

Milestones describe product capability rather than strict release boundaries. Work already completed for a later milestone remains checked even while the current focus is Milestone 3.

### Milestone 1 — TV matching foundation (complete)

- [x] Electron desktop shell with native file/folder selection and recursive drag-and-drop import
- [x] TMDB TV search, details, artwork, direct-ID lookup, and literal-first year fallback
- [x] TVDB English aired-order episode adapter and metadata-agent boundary
- [x] durable provider cache with stale-data fallback and bounded retention
- [x] automatic show inference from common numbered and seasonless episode filenames
- [x] whole-show episode browser grouped by season
- [x] confidence scoring from episode numbers and normalized title evidence
- [x] ranked alternatives, manual rematching, and explicit confirmation of uncertain matches
- [x] configurable show-folder and episode-filename templates with live examples
- [x] release-tag parsing and `ffprobe` inspection for video/audio technical metadata

### Milestone 2 — safe execution and desktop workflow (complete)

- [x] portable filename validation and live source/destination preflight
- [x] collision-safe numbering that keeps video and companion filenames aligned
- [x] atomic same-filesystem renames and safely published cross-filesystem moves
- [x] durable operation history, automatic rollback, and verified undo
- [x] cooperative Stop and in-progress Undo controls
- [x] per-batch Move/In place mode with separate TV and Movie destinations
- [x] companion-file planning for subtitles, NFO metadata, and episode artwork
- [x] optional removal of empty immediate source folders
- [x] filesystem monitoring for external deletes, renames, and moves
- [x] animated progress, elapsed/estimated timing, and optional completion reports
- [x] persisted preferences, appearance palettes, localization, and post-rename actions
- [x] dockable debug console and JSON dry-run export

### Milestone 3 — resilient matching and metadata (in progress)

- [x] compact, separated, and seasonless episode-marker variants
- [x] best-effort title matching with number/title conflict review
- [x] anime-style version suffixes normalized to release metadata
- [x] confidence thresholds plus current-batch source and AI-upscale overrides
- [x] duration evidence through `ffprobe`
- [x] contiguous multi-episode filename detection, grouped matching, combined runtime evidence, and range formatting
- [x] season-zero specials, TVDB absolute ordering, and explicit `SP`/`Special`/`OVA`/`OAD` anime filename patterns
- [ ] editable release-tag vocabulary and aliases
- [ ] folder parsing, per-show rules, and saved matching decisions
- [ ] NFO export
- [ ] embedded-title and adjacent-file ordering evidence

### Milestone 4 — movies and library workflows (started)

- [x] per-file movie batch matching with automatic title/year inference, independent TMDB results, and manual row review
- [x] separate persisted Movie destination, folder template, and filename template
- [ ] runtime-assisted movie disambiguation
- [ ] multipart movie grouping and extras/sample detection
- [ ] movie batch status filters and bulk retry controls
- [x] FlexGet-compatible movie edition vocabulary, aliases, source-order joining, and title-safe suffix detection
- [x] explicit arbitrary TV/anime editions with malformed/conflict validation
- [ ] per-file edition editing and saved custom edition aliases
- [ ] collection-aware folder and filename fields
- [ ] saved library roots and repeatable batch queues

### Milestone 5 — release readiness (planned)

- [ ] signed and notarized macOS build
- [ ] signed Windows build and packaged Linux build
- [ ] update channel with release notes and safe migrations
- [ ] in-app provider setup and first-run validation
- [ ] keyboard, screen-reader, contrast, and reduced-motion audit
- [ ] large-batch performance, interruption-recovery, and cross-platform integration testing

## Architecture boundary

```text
Renderer (React)
  -> use cases: search, import, match, preview, execute, undo
    -> domain: MediaItem, Episode, ReleaseTags, MatchCandidate, RenamePlan
      -> adapters: TMDB / TVDB / cache / ffprobe / filesystem
Electron preload exposes a deliberately small IPC surface to the renderer.
```

Provider responses should be normalized immediately. API keys stay in the main process, paths are validated before filesystem operations, and renderer code never receives unrestricted Node access.

## Next implementation slice

Milestones 1 and 2 are complete, and Milestone 3 is active. The remaining work is currently ordered as:

1. Add editable release-tag aliases, folder parsing, per-show rules, and saved match decisions.
2. Add NFO export alongside the existing dry-run JSON export.
3. Add embedded-title and adjacent-file ordering evidence.
4. Complete movie-specific disambiguation, editions, cuts, collections, and reusable library workflows.
5. Finish release-readiness work: provider onboarding, accessibility, stress testing, signed packages, and updates.
