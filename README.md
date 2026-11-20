# 📺 Media Renamer

Media Renamer is a friendly, confidence-first desktop app for organising TV episodes and movies. Drop in a batch, review the proposed names, and let the app safely rename or move everything once you are happy.

It keeps useful release details, works with companion files such as subtitles and artwork, and makes uncertain matches visible instead of quietly guessing.

[Download Media Renamer](https://manix84.github.io/media-renamer/) · [Installation guide](INSTALLATION.md) · [Preferences guide](docs/preferences.md) · [Privacy](PRIVACY.md)

<p align="center">
  <img src="public/Screenshot%202026-11-20%20at%2012.44.01.png" alt="Media Renamer matching a season of Severance" width="100%">
</p>

> [!NOTE]
> Media Renamer is currently in alpha. Preview every batch before renaming important files, and keep backups of anything you cannot replace.

## ✨ What it does

Media Renamer turns untidy media filenames into consistent, Plex-friendly names without hiding the decisions it makes. It combines episode numbers, titles, embedded metadata, duration, and library context to produce a confidence score for every match.

TV episodes use TVDB aired ordering for predictable Plex-compatible numbering, while TMDB supplies search, artwork, movie data, and supporting show metadata. Movies are matched independently, so a mixed folder can still become a clean, organised batch.

<p align="center">
  <img src="public/Screenshot%202026-11-20%20at%2012.47.02.png" alt="A matched movie batch with posters, logos, technical details, and filename previews" width="100%">
</p>

## 🧭 A simple workflow

Add files or a whole folder, choose TV or Movies, and let Media Renamer build a preview. Confident matches are ready immediately; uncertain files stay clearly marked for review, where you can search for a different episode or movie before anything changes on disk.

When the plan passes preflight, choose whether to rename in place or move the files into your library. Progress remains visible throughout the operation, and completed work is recorded so it can be undone safely.

<p align="center">
  <img src="public/Screenshot%202026-11-19%20at%2008.45.12.png" alt="Media Renamer moving a TV batch with live per-file progress" width="100%">
</p>

## 🛡️ Built around safe changes

Every operation begins as a non-destructive preview. Media Renamer checks source files, destination names, collisions, companion files, and filesystem state before enabling the rename button. Existing destinations are never silently overwritten.

Rename history is stored locally as a durable operation log. You can stop a running batch without losing completed work, undo the finished portion, or reverse the last successful operation after the app has restarted.

## 🎬 TV, movies, and companion files

TV mode understands common patterns such as `S01E02`, `1x02`, seasonless episode numbers, anime-style versions, and multi-episode files. Review results are shown as individual episodes, with Ctrl/Cmd and Shift selection available when one video contains more than one episode.

Movie mode detects each title separately and keeps editions, collections, extras, and multipart releases organised. Both workflows preserve useful source, resolution, codec, audio, language, flag, and release-group information when it is available.

Subtitles, NFO files, and named artwork can travel with their video. Optional Plex sidecar export can create local metadata and use familiar names for posters, backgrounds, logos, banners, season art, and episode thumbnails.

<p align="center">
  <img src="public/Screenshot%202026-11-20%20at%2012.47.39.png" alt="Movie details beside a matched batch in Media Renamer" width="100%">
</p>

## 🎨 Made for real libraries

The interface includes Light, Dark, and automatic system appearances, colour palettes, reduced-motion support, and seasonal themes. Artwork-rich TV and movie details make large batches easier to recognise without turning the rename list into a wall of technical text.

Filename and folder templates are editable, reusable, and previewed live. Separate TV and Movie destinations let each library keep its own structure, while saved queues and library roots make repeat jobs quicker.

<p align="center">
  <img src="public/Screenshot%202026-11-20%20at%2012.44.38.png" alt="Full-size artwork preview inside Media Renamer" width="100%">
</p>

## 📦 Download and install

Ready-made releases are available for Windows, macOS, and Linux. Installed editions use the normal application-data location for preferences and history; portable editions keep their data beside the app so the whole setup can travel together.

Media Renamer is currently unsigned, so Windows and macOS will show the expected security warning. The [installation guide](INSTALLATION.md) explains each platform, portable data locations, checksums, and release verification.

**[Visit the download page →](https://manix84.github.io/media-renamer/)**

## ⚙️ Set up your preferences

The defaults are deliberately conservative, so you can start by adding a few files and reviewing the preview. When you are ready, the Preferences drawer lets you choose library destinations, naming templates, matching thresholds, appearance, cleanup behaviour, and what happens after a rename.

The **[Preferences guide](docs/preferences.md)** walks through every tab and option, with quick recommendations for a first setup and detailed explanations when you need more control.

## 🧰 Run from source

Local development needs a current Node.js release and `ffprobe` on `PATH` (installed with FFmpeg). Copy the example environment file and add your own TMDB read token and eligible TVDB API key.

```bash
npm install
cp .env.example .env
npm run dev
```

Run the complete test and production-build gate with `npm run check`. Development credentials stay in Electron's main process and `.env` is ignored by Git. Published builds use a restricted native helper for bundled TMDB access; TVDB credentials remain user-supplied and are never included in release artifacts.

## 🔌 Extensions

Optional features can be installed through the extension system without changing the safe rename planner, preflight checks, operation log, or undo behaviour. Media Renamer works normally without extensions, and all installed extensions begin disabled.

The Anime library router is the first development example. See the [extension guide](extensions/README.md) for package formats, permissions, installation, and development notes.

## 🔐 Privacy and security

Media Renamer is local-first. It does not require a Media Renamer account, and its matching cache, preferences, rename history, and operation logs remain on your computer. Metadata requests go only to the configured providers.

Read the [privacy policy](PRIVACY.md) for data-handling details, the [release security guide](docs/release-security.md) for the threat model, and the [code-signing policy](docs/code-signing-policy.md) for the planned signing process.

## 🗺️ Project status

The core TV and movie workflows, safe execution, undo, companion-file handling, templates, artwork, and cross-platform packaging are working today. Current development is focused on release readiness, accessibility, provider onboarding, performance testing, signing, and carefully designed opt-in diagnostics.

Release notes live in [WHATSNEW.md](WHATSNEW.md), and planned extension work lives in [extensions/ROADMAP.md](extensions/ROADMAP.md). Keeping those details outside this page lets the README stay welcoming while the deeper project record remains available.

## 🙌 Credits

Episode metadata is supplied by [TheTVDB](https://thetvdb.com/). Search, movie metadata, and artwork use [TMDB](https://www.themoviedb.org/); this product uses the TMDB API but is not endorsed or certified by TMDB. Approved anime extensions may also use [AniList](https://anilist.co/).

Media Renamer is released under the [MIT License](LICENSE).
