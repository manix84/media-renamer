# What's New

This file is the source of truth for user-facing release notes. Add noteworthy changes beneath **Unreleased** as they land. Before tagging a release, move those entries into a versioned section whose heading matches the package version.

## [Unreleased]

### Added

- Cross-platform packaging for Linux, Windows, and macOS through GitHub Actions.
- Community health files for contribution, support, security, and issue reporting.
- Nested rename progress for movie batches, showing both overall file progress and progress through each movie's video and associated sidecars.
- Clickable movie-row posters using the same full-size, zoomable preview as TV-show artwork.
- Rename progress recovery after a renderer refresh, with the live dialog and Stop/Undo controls restored automatically and a persistent **View progress** action.
- Bidirectional episode navigation: selecting a file highlights its matched episode(s), while selecting an episode highlights and reveals its associated file(s); click again to toggle the selection off, click away, or wait 40 seconds.
- Smoother rename progress during cross-filesystem moves, detecting separate filesystems before attempting an atomic rename, reporting bytes copied within the active file, and distinguishing pending work with moving stripes from measurable work with a periodic progress sweep.
- Split-title episode handling that offers either episode or the combined match, while using the first episode number and a shared title without trailing part markers for combined filenames.
- A selected-episode detail pane in the episode sidebar with the episode capture and description.
- Reliable TVDB episode captures fetched through the trusted Electron host, with validated image responses and a clean placeholder when artwork cannot be loaded.
- TMDB episode captures merged into TVDB-aired metadata by season and episode number when TVDB does not provide an image.
- Episode-grouped rename progress that counts videos as episodes while tracking each episode's subtitles and other sidecars on a secondary progress bar.
- Light-background show and movie clearlogos selected in TMDB quality order using local contrast qualification, with the dark CSS treatment retained when no suitable artwork exists.
- Automatic TVDB discovery when TMDB has no show result or a selected TMDB show lacks a usable TVDB cross-reference.
- Media-detail pills aligned beneath the original filename they describe, with match evidence available by hovering over the proposed filename.
- Inline proposed-filename editing by double-click, with companion files following the edited basename.
- Windows-compatible sanitization of slashes and other reserved characters in provider-supplied show, movie, collection, and edition folder names.

## [0.1.0] - 2026-10-26

### Added

- Confidence-first TV episode and movie matching with explicit review for uncertain results.
- Safe rename and move execution with preflight validation, durable history, rollback, and undo.
- Configurable naming templates, release metadata detection, subtitle organisation, and optional Plex sidecars.
- Saved library roots, repeatable batch queues, appearance themes, localization, and developer diagnostics.
- A capability-gated extension system with Anime library routing and declarative examples.

### Security

- Provider credentials remain in the Electron main process.
- Filesystem operations and extension manifests are validated at the application boundary.

[Unreleased]: https://github.com/manix84/media-renamer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/manix84/media-renamer/releases/tag/v0.1.0
