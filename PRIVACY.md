# Privacy

**Effective date:** 12 November 2026

Media Renamer is built around a simple principle: your media library is yours. A filename can reveal what you watch, where you store it, how your household systems are organised, and sometimes more than you intended to share. The application therefore keeps library processing on your computer and only sends the minimum information needed when you choose to use an online metadata service.

This document explains what Media Renamer handles, where that information goes, and what remains under your control.

## The short version

- Media Renamer has no user accounts, advertising, behavioural analytics, telemetry, or automatic crash reporting.
- Your media files, directory structure, preferences, rename history, installed extensions, and generated rename plans remain on your computer.
- Media files are not uploaded to the Media Renamer project or to metadata providers.
- Metadata searches send a title, provider identifier, language, season number, or similarly limited request data to the provider needed for that feature.
- Optional extensions may contact their declared services only after you install and enable them and grant the requested capability.
- The project website does not include project-operated analytics or advertising trackers.

## Information handled on your computer

Media Renamer reads information required to prepare and carry out the work you request. Depending on the feature, this may include:

- file and folder names;
- full source and destination paths;
- file type, size, and filesystem information;
- embedded video and audio metadata, such as resolution, codecs, duration, language, channels, and embedded titles;
- companion-file information for subtitles, artwork, and metadata files;
- your selected shows, movies, episodes, matches, naming patterns, destinations, and manual corrections;
- application preferences, saved library roots, saved queues, and extension settings;
- rename plans, preflight results, operation history, and the information needed to undo completed work; and
- optional locally generated NFO files, artwork, and rename logs.

This processing happens locally. The Media Renamer project does not receive a copy of this information.

## Information stored locally

Standard installations store preferences, metadata cache entries, rename history, statistics used by enabled local integrations, extension packages, and extension settings in the operating system's application-data location for Media Renamer. The Linux USB-portable edition stores its application data inside the portable bundle's adjacent `data` directory so it can travel with the application.

If you enable external rename logs or generate sidecar files, those files are written to the destination you selected. They may contain filenames and paths, so treat them as part of your library data.

Extension credentials are stored only when an extension requires them and you choose to save them. Media Renamer uses Electron's operating-system-backed secure storage and refuses to save extension secrets when encryption is unavailable.

Local data remains until you clear it, remove the relevant files, or delete the application's data directory. Uninstalling the application may not remove its application-data directory or externally generated logs and sidecars.

## Network requests

Media Renamer is not a cloud service, but metadata features need to contact the selected metadata provider. Requests may contain:

- a show or movie search term inferred from a filename or entered by you;
- a TMDB, TVDB, IMDb, or provider-specific identifier;
- a language, season number, episode ordering choice, or result page; and
- requests for posters, backgrounds, clearart, episode captures, and other selected artwork.

The application does not intentionally send local media files, full local paths, rename history, naming templates, unrelated filenames, or your broader library contents with those requests.

The default released application uses a dedicated, read-only project token for TMDB requests. Optional TVDB support uses credentials supplied by the user where required. AniList and other metadata services may be used by optional extensions. Each provider receives ordinary network information, such as your IP address, and processes requests under its own terms and privacy policy:

- [TMDB](https://www.themoviedb.org/privacy-policy)
- [TheTVDB](https://thetvdb.com/privacy-policy)
- [AniList](https://anilist.co/terms)

Media Renamer caches some provider responses locally to improve performance and reduce repeated requests.

## Extensions and integrations

Extensions are optional and disabled by default. An extension must declare the capabilities and network origins it needs. Media Renamer requires the extension to be enabled and its network capability to be granted before it can make metadata requests, and it limits those requests to the declared HTTPS origins.

An enabled extension or integration may send the information described in its settings to a service you configure. Review an extension before enabling it, particularly if it comes from someone other than the Media Renamer project. Third-party extensions and services have their own privacy practices.

## Website, downloads, and GitHub

The Media Renamer website is a static GitHub Pages site. It does not use project-operated analytics, advertising trackers, or a Media Renamer account system. It stores only your light, dark, or automatic theme preference in the browser's local storage and requests public release information from GitHub so it can display current downloads.

GitHub hosts the source repository, website, release downloads, issue tracker, build provenance, and security reports. GitHub may process connection details and usage information under the [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

Anything you post publicly in a GitHub issue, discussion, pull request, or other public project area can be read by other people. Do not include private filenames, local paths, credentials, tokens, or other sensitive library information in public reports.

## Data we do not collect

The Media Renamer project does not operate a server that collects application usage. The application does not send the project maintainer:

- an advertising or analytics identifier;
- a list of your media files or folders;
- your rename history or preferences;
- your saved provider or extension credentials;
- background usage reports;
- automatic crash reports; or
- information for sale or targeted advertising.

If private-by-design error reporting is added in the future, it will be opt-in, show the complete report before sending, and require a separate update to this document before release.

## Your choices and control

You can use the local renaming and planning features without creating a Media Renamer account. You can avoid optional providers or extensions, remove installed extensions, delete saved extension credentials, clear locally stored application data, and remove generated logs or sidecars from their chosen destinations.

Because the project does not receive your local application data, it cannot retrieve, export, correct, or delete that data for you. Those actions remain under your control on the device where Media Renamer is used. For data held by a metadata provider or GitHub, contact that service directly.

## Security and privacy reports

Privacy is an ongoing engineering constraint, not a one-time statement. Changes that introduce new network access, reporting, or externally stored data should be documented and reviewed before release.

If you find an issue that could expose private data, credentials, or filesystem information, do not open a public issue. Use [GitHub private vulnerability reporting](https://github.com/manix84/media-renamer/security/advisories/new). General privacy questions that contain no sensitive information may be raised in the [public issue tracker](https://github.com/manix84/media-renamer/issues).

## Changes to this document

Material privacy changes will be recorded in the repository and included with the release that introduces them. The version history remains publicly reviewable through Git.
