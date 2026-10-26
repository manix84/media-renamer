# What's New

This file is the source of truth for user-facing release notes. Add noteworthy changes beneath **Unreleased** as they land. Before tagging a release, move those entries into a versioned section whose heading matches the package version.

## [Unreleased]

### Added

- Cross-platform packaging for Linux, Windows, and macOS through GitHub Actions.
- Community health files for contribution, support, security, and issue reporting.
- Nested rename progress for movie batches, showing both overall file progress and progress through each movie's video and associated sidecars.
- Clickable movie-row posters using the same full-size, zoomable preview as TV-show artwork.
- Rename progress recovery after a renderer refresh, with the live dialog and Stop/Undo controls restored automatically and a persistent **View progress** action.

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
