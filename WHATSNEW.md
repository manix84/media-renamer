# What's New

This file is the source of truth for user-facing release notes. Add noteworthy changes beneath **Unreleased** as they land. Before tagging a release, move those entries into a versioned section whose heading matches the package version.

## [Unreleased]

### Added

- The project website now offers Light, Dark, and automatic system themes, with a matching genuine app screenshot populated from real Severance artwork and Season 1–2 episode metadata.

### Fixed

- macOS release bundles now receive a complete ad-hoc signature so Gatekeeper no longer misidentifies the unsigned application as damaged.

## [0.5.0] - 2026-11-12

### Added

- A dedicated Media Renamer website now introduces the confidence-first workflow, provides current platform downloads, and documents privacy, verification, and the pending SignPath Foundation signing programme.

## [0.4.1] - 2026-11-12

### Added

- Media Renamer is now published under the MIT License, with SHA-256 checksums, verifiable GitHub build provenance, and clear installation guidance for unsigned macOS and Windows releases.

## [0.4.0] - 2026-11-12

### Added

- A dedicated About preferences tab now brings together Media Renamer's purpose, privacy details, author links, provider credits, and open-source licence acknowledgements.

## [0.3.0] - 2026-11-11

### Added

- TMDB is now the default source for TV episode ordering, with persisted optional TVDB aired ordering for users who configure their own eligible credentials.
- Provider credits now include TMDB's approved logo and required notice, alongside clear TVDB and AniList usage disclosures.
- Release builds now compile the protected TMDB credential into a stripped, fixed-origin native request helper so packaged apps work without asking users to configure provider credentials.

## [0.2.2] - 2026-11-11

### Fixed

- Windows releases now publish distinct installer and portable executable filenames instead of allowing one target to overwrite the other.

## [0.2.1] - 2026-11-11

### Fixed

- Cross-platform release tests no longer apply POSIX file-mode expectations on Windows, where those permission bits are not supported.

## [0.2.0] - 2026-11-11

### Added

- Cross-platform packaging for Linux, Windows, and macOS through GitHub Actions, including AppImage, Debian, RPM, USB-portable, NSIS, DMG, and ZIP releases.
- Automatic semantic version selection, release-note rollover, and regenerated GitHub Releases whenever a prepared change reaches `main`.
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
- Light-background show and movie clearlogos selected in TMDB quality order, with a tight dark outline preserving the original logo colours and keeping pale artwork legible.
- Automatic TVDB discovery when TMDB has no show result or a selected TMDB show lacks a usable TVDB cross-reference.
- Media-detail pills aligned beneath the original filename they describe, with match evidence available by hovering over the proposed filename.
- Inline proposed-filename editing by double-click, with companion files following the edited basename.
- Windows-compatible sanitization of slashes and other reserved characters in provider-supplied show, movie, collection, and edition folder names.
- Red warning treatment for the `UNCENSORED` media flag.
- A clear restart prompt instead of a raw IPC error when a development renderer is newer than its running Electron host.
- Rename execution on virtual and cloud-backed filesystems that do not support hard links, using native rename or temporary-copy publication instead.
- A documented self-contained provider and release-security plan covering credential containment, Electron hardening, artifact inspection, provenance, and rotation.

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

[Unreleased]: https://github.com/manix84/media-renamer/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/manix84/media-renamer/releases/tag/v0.5.0
[0.4.1]: https://github.com/manix84/media-renamer/releases/tag/v0.4.1
[0.4.0]: https://github.com/manix84/media-renamer/releases/tag/v0.4.0
[0.3.0]: https://github.com/manix84/media-renamer/releases/tag/v0.3.0
[0.2.2]: https://github.com/manix84/media-renamer/releases/tag/v0.2.2
[0.2.1]: https://github.com/manix84/media-renamer/releases/tag/v0.2.1
[0.2.0]: https://github.com/manix84/media-renamer/releases/tag/v0.2.0
[0.1.0]: https://github.com/manix84/media-renamer/releases/tag/v0.1.0
