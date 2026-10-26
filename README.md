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
- parsing for BluRay (including standalone `BD` folder tags), WEB-DL, WEBRip, HDTV, DVDRip, TVRip, leading or trailing release groups, normalized web-service origins, and common flags, with `ffprobe` detection overriding filename guesses for resolution, video/audio codecs, and channels, collecting every tagged audio language, and contributing duration evidence to episode matching;
- persisted custom release-tag aliases for sources, resolutions, codecs, channels, flags, and WEB origins without replacing the built-in vocabulary;
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
- opt-in move preferences that clear a conservative allowlist of recognized release-site promotional junk and zero-byte subtitle files after a successful move, while preserving non-empty unlabelled subtitles and other unrecognized files;
- post-rename preferences for automatically clearing fully completed batches, showing an optional completion report (on by default), playing an optional completion chime that sounds once when enabled (with distinct Halloween and Christmas sounds), and writing timestamped JSON operation logs to a chosen folder or the active media destination, while retaining the internal undo record;
- per-file match review with ranked suggestions, full episode search, manual selection, and explicit confirmation before preflight accepts uncertain matches;
- persisted per-show matching rules for title evidence and automatic-confirmation thresholds;
- embedded container-title evidence plus conservative adjacent-file sequence evidence for difficult episode batches;
- optional Plex NFO export for movies, series, episodes, and multi-episode files, accompanied by every available Plex-named provider artwork sidecar (poster, background, logo, square art, banner, season poster, and episode thumbnail); both exports are off by default;
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
4. Add supporting evidence from the embedded container title and `ffprobe` duration when they agree with provider metadata; neither creates a high-confidence match by itself.
5. For a lexically ordered batch, suggest the single episode bracketed by two confidently numbered adjacent files. This remains a review match unless the configured threshold permits it.
6. Surface contradictions—such as `S02E07` containing the exact title of episode 8—as review items instead of hiding the decision.
7. Apply saved show-specific title-matching and confidence settings when present, then automatically accept matches at or above the effective threshold (80% globally by default).

Provider ordering is supporting metadata, not ground truth.

## Plex metadata sidecars

NFO and artwork exports are independent opt-in preferences and are disabled by default. Generated files join the normal rename execution and are covered by the operation log and Undo. Existing local NFO or artwork destinations are preserved rather than overwritten or renamed to forms Plex would not recognize.

Movies receive a filename-matched `.nfo`; TV libraries receive `tvshow.nfo` plus filename-matched episode NFOs. A merged episode file emits one `<episodedetails>` block per episode. Available provider images use Plex local-asset names: `poster`, `background`, `logo`, `square`, `banner`, season poster names, and filename-matched episode thumbnails. Missing artwork classes are omitted rather than synthesized from an unsuitable image.

## Filename templates

Episode names use a Mustache-style template that can be laid out and indented like a script while always producing a single-line filename. After rendering, every run of whitespace becomes one space and leading or trailing whitespace is removed. Other text outside `{{…}}` is literal, so brackets and parentheses need no escaping. `{{#value}}…{{/value}}` includes optional content when a value exists; an `episodes` section repeats for every episode in a merged file. The built-in format is:

```text
{{show.name}}{{#show.year}} ({{show.year}}){{/show.year}} -
  {{episode.range}} -
  {{#episodes}}{{^first}}, {{/first}}{{title}}{{/episodes}}{{#technical}} [{{technical}}]{{/technical}}{{#show.tvdbId}} {tvdb-{{show.tvdbId}}}{{/show.tvdbId}}
```

The syntax-highlighted editor lives in the right-side Preferences drawer, shows a two-episode output immediately, and reports incomplete, mismatched, or unknown tags without breaking rename previews. A collapsible reference alongside it documents every available variable and the variable, section, and inverted-section syntax. Templates are retained locally between launches. The default appends the show's canonical TVDB ID as `{tvdb-74550}` when TMDB supplies that cross-reference. Release templates can use `{{release.group}}`, the normalized full web origin through `{{release.webOrigin}}`, or its canonical shorthand through `{{release.webOriginShort}}`. Tagged audio streams are available as the joined fields `{{audio.languageNames}}`, `{{audio.languageCodes3}}`, and `{{audio.languageCodes2}}`, or as a repeating `{{#audio.languages}}` section containing `name`, `code3`, and `code2`.

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
| 2 — Safe execution and desktop workflow | Complete | 13 of 13 steps |
| 3 — Resilient matching and metadata | Complete | 14 of 14 steps |
| 4 — Movies and library workflows | Complete | 11 of 11 steps |
| 5 — Editing and confirmation | Complete | 6 of 6 steps |
| 6 — Media detection and subtitle organisation | Complete | 4 of 4 steps |
| 7 — Versioning, developer tools, and personality | In progress | 9 of 11 steps |
| 8 — Private-by-design error reporting | Planned | 0 of 39 steps |
| 9 — Release readiness | Started | 1 of 7 steps |

Milestones describe product capability rather than strict release boundaries. Work may cross milestone boundaries when a real-world batch exposes a more useful next step.

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
- [x] optional pruning of empty source and companion folders after moving
- [x] opt-in cleanup of recognized release-site junk and zero-byte subtitle sidecars
- [x] filesystem monitoring for external deletes, renames, and moves
- [x] animated progress, elapsed/estimated timing, and optional completion reports
- [x] persisted preferences, appearance palettes, localization, and post-rename actions
- [x] dockable debug console and JSON dry-run export

### Milestone 3 — resilient matching and metadata (complete)

- [x] compact, separated, and seasonless episode-marker variants
- [x] best-effort title matching with number/title conflict review
- [x] anime-style version suffixes normalized to release metadata
- [x] confidence thresholds plus current-batch source and AI-upscale overrides
- [x] duration evidence through `ffprobe`
- [x] contiguous multi-episode filename detection, grouped matching, combined runtime evidence, and range formatting
- [x] season-zero specials, TVDB absolute ordering, and explicit `SP`/`Special`/`OVA`/`OAD` anime filename patterns
- [x] editable release-tag vocabulary and aliases
- [x] ordered, deduplicated audio-language detection with full-name, ISO 639-2, and ISO 639-1 template fields
- [x] conservative show/season folder evidence for sparsely named episode files
- [x] per-show rules
- [x] saved per-show filename-to-episode decisions with stale-decision conflict handling
- [x] opt-in Plex NFO export with available local artwork sidecars
- [x] embedded-title and adjacent-file ordering evidence

### Milestone 4 — movies and library workflows (complete)

- [x] per-file movie batch matching with automatic title/year inference (including chronological year-prefixed collections), independent TMDB results, exact TV-miniseries fallback, and manual row review
- [x] direct movie lookup by TMDB or IMDb ID, with both identifiers available to filename and folder templates
- [x] separate persisted Movie destination, folder template, and filename template
- [x] runtime-assisted movie disambiguation using `ffprobe` duration and leading TMDB candidate runtimes
- [x] conservative multipart movie grouping, Plex-style extras naming, and visible blocked sample detection
- [x] movie batch status filters and bulk retry controls
- [x] FlexGet-compatible movie edition vocabulary, aliases, source-order joining, and title-safe suffix detection
- [x] explicit arbitrary TV/anime editions with malformed/conflict validation
- [x] per-file edition editing and saved custom edition aliases
- [x] collection-aware folder and filename fields (`movie.collection.name` and `movie.collection.tmdbId`)
- [x] saved library roots and repeatable batch queues

### Milestone 5 — editing and confirmation (complete)

- [x] media-item editing modal with inputs for every editable field, validation, filename previews, Save, and Cancel
- [x] episode-level metadata editing for TV shows
- [x] one-click confirmation for an individual movie suggestion
- [x] reliable movie Confirm All with an explained list of files that still require manual review
- [x] result-driven movie Match modal with immediate search, posters, titles, years, selectable results, and query refinement
- [x] extend the unconfirmable-item dialogue to TV shows and individual episodes where appropriate

### Milestone 6 — media detection and subtitle organisation (complete)

- [x] same-directory subtitle discovery with language/role suffix preservation and collision-safe planning
- [x] conservative junk cleanup that preserves non-empty subtitles and unknown sidecars
- [x] asymmetric media filtering: defer obvious episodes in Movies, accept episode and movie-like specials in TV, and never silently discard ambiguous imports
- [x] discover `Subs`, `Subtitles`, and similar movie subfolders; associate subtitles with their movie; detect filename language, Forced, and SDH variants; preview Plex-compatible names; move them alongside the movie without overwriting or deleting originals before success

### Milestone 7 — versioning, developer tools, and personality (in progress)

- [x] Give every seasonal theme a distinct completion chime, including a Deck the Halls phrase for Christmas.

- [x] use the package/application version as the single build and runtime source, avoiding duplicated self-mutating version files
- [x] display the current application version at the bottom of Preferences
- [x] hidden, locally persisted developer mode for developer-only diagnostics
- [x] unlock developer mode by clicking the version seven times
- [x] after the third version click, show and update the remaining-click count
- [x] show Halloween only in October and Christmas only in December, with developer-mode preview and an automatic Classic fallback outside each season
- [x] add Valentine’s, Pride, Bonfire Night, New Year, Spring, Summer, Autumn, and Winter themes, with event themes taking priority over broad seasons
- [x] give seasonal themes distinct reduced-motion-aware ambience: hearts, petals, sunlight motes, leaves, embers, fireworks, ice crystals, bats, snow, and flowing Pride colours
- [ ] replace seasonal-theme colour dots with appropriate emojis
- [ ] add a hidden, non-disruptive Easter egg

### Milestone 8 — private-by-design error reporting (planned)

Error reporting must be entirely optional, disabled by default, and initiated for each report by the user. Nothing may be captured or transmitted in the background. The final review must show the exact public GitHub issue body and image that will be submitted, with no additional hidden payload.

#### Consent and review

- [ ] add an **Anonymous error reporting** preference, off by default, which exposes reporting tools without granting standing consent to submit reports
- [ ] require an explicit final confirmation for every report and explain that the resulting GitHub issue and any screenshot will be public
- [ ] provide an editable report composer for the title, problem description, expected behaviour, actual behaviour, and reproduction steps
- [ ] allow every diagnostic section, history event, and attachment to be edited or removed before submission
- [ ] show this guidance in the review screen: “The automatically collected information has already been anonymised. Removing additional details is completely fine, but it may make the problem more difficult to diagnose or reproduce.”
- [ ] cancel without transmitting anything and delete all temporary report artifacts on cancellation, successful submission, application exit, or expiry

#### Automatic reproduction history

- [ ] maintain a bounded, memory-only structured action history separate from the human-readable debug console
- [ ] record diagnostic actions rather than raw UI prose: mode changes, imports, batch classification, searches, match selections, confirmations, template or destination changes, preflight results, rename operations, stops, completions, and undo operations
- [ ] automatically turn that history into ordered, editable reproduction steps in the report composer
- [ ] record counts, workflow stages, result categories, provider names, and error codes without recording credentials, file contents, or unapproved raw paths
- [ ] let the user rewrite, reorder, add, or delete generated steps without changing the retained local history

#### Anonymous path and URI diagnostics

- [ ] assign consistent random report-local tokens such as `<source-1>`, `<directory-2>`, and `<file-7>.mkv`; never derive tokens from reversible or guessable path hashes
- [ ] retain diagnostically relevant structure: platform path style, absolute/relative state, directory depth, extension, total character and UTF-8 byte length, component lengths, and collision suffix effects
- [ ] detect NFC/NFD or mixed Unicode normalization, non-ASCII and combining characters, invisible or control characters, reserved characters and names, trailing spaces or periods, repeated or mixed separators, percent-encoded sequences, dot segments, multiple extensions, case-only differences, and abnormal filename/path lengths
- [ ] describe suspicious characters by position and escaped Unicode code point without including the surrounding private title by default
- [ ] calculate both source and generated-destination diagnostics so path-length, normalization, portability, and collision failures remain reproducible
- [ ] show each original path locally beside its anonymised representation and offer per-path controls for **Keep anonymous** (default), **Include suspicious fragment only**, **Include filename only**, or **Include complete path**
- [ ] warn that filenames and complete paths may disclose usernames, media titles, and private folder names; include raw values only when the user deliberately approves them
- [ ] ensure raw paths are not sent in hidden JSON, logs, image metadata, headers, or an auxiliary payload when the anonymised representation is selected

#### Screenshot capture and redaction

- [ ] make screenshots independently optional and off by default, even after reporting tools are enabled
- [ ] capture only the Media Renamer window through Electron; never capture the desktop, another application, native file dialogs, or hidden windows
- [ ] preview the captured image and provide remove, retake, crop, rectangle-redact, and undo-redaction controls
- [ ] flatten redactions and strip image metadata before submission
- [ ] store screenshots only in a private temporary directory and enforce image dimensions and payload-size limits

#### Diagnostic allowlist and sanitisation

- [ ] build reports from an explicit allowlist: application version/build channel, broad operating-system version, architecture, active media mode, workflow stage, aggregate counts, relevant boolean preferences, configured-provider status, sanitised error code/message/stack, approved debug events, and approved path diagnostics
- [ ] never collect API keys, tokens, request headers, environment variables, hostnames, machine IDs, serial numbers, network addresses, file contents, rename-history files, GitHub credentials, or persistent user identifiers
- [ ] redact home-directory usernames, absolute paths, secrets, URLs with credentials/query secrets, and provider tokens locally before the review is generated
- [ ] add adversarial tests for Windows, POSIX, UNC, Unicode, control-character, overlong, credential-bearing, and malformed paths plus regression tests proving that rejected fields cannot cross the IPC boundary

#### Anonymous GitHub delivery

- [ ] do not ship a GitHub write token in the desktop application
- [ ] submit the reviewed payload through a narrowly scoped relay authenticated as a dedicated GitHub App or bot so the issue does not require or disclose the reporter's GitHub identity
- [ ] publish a concise privacy statement clarifying that the report contains no application-supplied identity while hosting and network providers may transiently observe connection metadata such as an IP address
- [ ] validate the report schema server-side, reject unknown fields, strip attachment metadata again, limit body and image sizes, rate-limit abuse, and avoid retaining report bodies or screenshots after submission
- [ ] format issues consistently with Problem, Expected behaviour, What happened, Reproduction steps, Application context, Relevant settings, Sanitised diagnostics, and Privacy confirmation sections
- [ ] apply dedicated bot-authored labels such as `anonymous-report`, problem category, platform, and application version without adding a reporter identifier
- [ ] implement a controlled GitHub-compatible image attachment path; keep text-only submission available when screenshots are omitted or attachment storage is unavailable

#### Failure handling and verification

- [ ] never retry a failed submission silently; offer **Try again**, **Save report locally**, **Copy Markdown**, and **Open GitHub manually**
- [ ] make the local export contain exactly the reviewed `report.md`, optional flattened screenshot, and reviewed diagnostics JSON—nothing else
- [ ] return and display the created issue URL after success
- [ ] test cancellation, offline submission, relay rejection, rate limiting, oversized payloads, temporary-file cleanup, renderer compromise boundaries, Markdown injection, image metadata stripping, and final-preview parity

### Milestone 9 — release readiness (in progress)

- [x] automated unsigned Linux, Windows, and macOS packages with tag-driven GitHub Releases
- [ ] signed and notarized macOS build
- [ ] signed Windows build
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

## Releases

GitHub Actions builds unsigned AppImage and Debian packages for Linux, NSIS and portable executables for Windows, and DMG and ZIP packages for macOS. Run **Build releases** manually to produce workflow artifacts without publishing a release.

Tagged builds also create a GitHub Release. To prepare one:

1. Move the relevant entries in `WHATSNEW.md` from **Unreleased** into a heading matching the package version, such as `## [0.2.0] - 2026-11-01`.
2. Update `package.json` and its lockfile to the same version.
3. Merge and tag that commit as `v0.2.0`, then push the tag.

The workflow refuses to publish when the matching `WHATSNEW.md` section is absent. Windows signing and macOS signing/notarization are intentionally deferred until their credentials are configured.

Optional features use the [installable extension system](extensions/README.md). Media Renamer runs normally without extensions; users can install packages after release, administrators can provide preinstalled packages, and developers can load local packages without copying them. The Anime library router is the first development example. Extensions remain disabled by default and cannot bypass the rename planner, preflight checks, execution log, or undo support.

## Next implementation slice

Milestones 1 and 2 are complete. The current backlog is ordered around the problems most likely to affect real media batches:

1. Complete Milestone 7 with emoji theme selectors and the hidden Easter egg.
2. Build the local-only report model, structured reproduction history, path analyser, sanitiser, and editable preview before adding any network submission.
3. Finish provider onboarding, accessibility, stress testing, signed packages, and updates.
