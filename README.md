# Media Renamer

A confidence-first desktop renamer for TV episodes, designed as a modern replacement for Rename My TV Series. Movie support is planned on the same metadata and formatting foundation.

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
- automatic show-name inference from imported episode filenames;
- literal-first title-and-year search with a structured year fallback;
- `S01E02` and `1x02` number matching;
- optional best-effort episode-title matching, including number/title conflicts;
- confidence states (`confident`, `review`, and `unmatched`);
- parsing for BluRay, WEB-DL, WEBRip, HDTV, DVDRip, TVRip, resolution, video/audio codecs, channels, release group, and common flags;
- deterministic output-name formatting;
- background-worker matching with visible per-file progress;
- a resizable debug console that docks left, right, or bottom, or pops into an independent window, while explaining provider activity, imports, and accepted, review, or rejected match decisions; and
- unit tests for the matching and release-tag core.

The UI searches TMDB and normalizes live show, season, and episode metadata. Safe filesystem execution is still intentionally disabled.

## Run it

Requires a current Node.js release.

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev:electron` is also available as an explicit alias for the complete desktop development stack. Both commands compile the Electron main/preload code, start Vite, and launch the app. Changes under `electron/` automatically recompile and restart Electron so the renderer and preload bridge cannot drift out of sync.

Add a TMDB v4 API Read Access Token to `.env` before starting the app:

```dotenv
TMDB_ACCESS_TOKEN=your_long_read_access_token_here
```

Create or retrieve the token under your TMDB account's **Settings → API** page. Do not add a `Bearer ` prefix. The token is read only by Electron's main process and is not exposed to the renderer. `.env` is ignored by Git.

Search accepts show names, TMDB IDs such as `tmdb-1396`, and TVDB IDs such as `tvdb-482771`. TVDB IDs are first resolved through TMDB's external-ID endpoint. When TMDB has no cross-reference, the app uses `TVDB_API_KEY` (and optional `TVDB_SUBSCRIBER_PIN`) to retrieve the title from TVDB, then locates the corresponding TMDB show.

This product uses the TMDB API but is not endorsed or certified by TMDB.

Run all current checks:

```bash
npm run check
```

## Matching model

Every imported file is ranked against the selected show's episodes. Evidence is additive:

1. Extract explicit season/episode numbers.
2. Normalize filename and episode titles (case, punctuation, diacritics, stop words, and release noise).
3. Score title coverage with a high recall bias because filenames contain extra show and release tokens.
4. Surface contradictions—such as `S02E07` containing the exact title of episode 8—as review items instead of hiding the decision.
5. Show the best alternatives and require confirmation below the confidence threshold.

Future matching evidence can include duration, air date, embedded title, adjacent-file ordering, absolute/anime numbering, and multi-episode ranges. Provider ordering is metadata, not ground truth.

## Delivery plan

### Milestone 1 — useful TV renamer

- [x] TMDB TV search/details/episode adapter
- local metadata cache
- TVDB adapter when credentials are configured
- [x] whole-show episode browser grouped by season, and file import
- candidate alternatives and manual rematching
- configurable name templates with live examples
- preflight collision/invalid-character checks
- atomic rename/move plan, JSON log, and undo

### Milestone 2 — resilient matching and tags

- duration and media-stream evidence through `ffprobe`
- multi-episode, specials, absolute ordering, and anime filename patterns
- editable release-tag vocabulary and aliases
- folder parsing, per-show rules, and saved matching decisions
- NFO and dry-run export

### Milestone 3 — movies and packaging

- movie search/import workflow using the same provider and tag interfaces
- editions, cuts, collections, and year/runtime disambiguation
- signed macOS/Windows/Linux builds and update channel

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

Add `RenamePlan` preflight, collision and invalid-character validation, operation logging, and undo before enabling the final Rename button. Preview-only UI is intentional until those safety rails exist.
