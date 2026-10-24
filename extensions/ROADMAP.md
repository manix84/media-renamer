# Extension development roadmap

This backlog captures the extension use cases Media Renamer intends to support. Each stage expands the host-owned API without granting extensions unrestricted Electron, Node, shell, network, credential, or filesystem access.

## Stage 1 — Declarative presentation and routing

- [x] Install, discover, replace, enable, disable, and uninstall extension packages.
- [x] Development, preinstalled, and user-installed package sources.
- [x] Metadata classification, badges, directory settings, and show/movie routing.
- [x] Extension-contributed media settings tabs with inherited destination, folder, and filename templates.
- [ ] Additional match fields: studios, networks, certifications, genres by stable provider namespace, collections, editions, audio/subtitle languages, HDR, resolution, codec, source, and release group.
- [ ] Host-rendered warnings, colours, icons, filters, and review explanations.
- [ ] Declarative routing for documentaries, concerts, stand-up, sport, children’s media, home videos, foreign-language media, 4K/HDR/remux libraries, and other user-defined categories.

## Stage 2 — Metadata and matching adapters

- [ ] Capability-scoped metadata adapters for AniList, MyAnimeList, IMDb, OMDb, Fanart.tv, MusicBrainz, TheAudioDB, and private/self-hosted services.
- [ ] Provider fallback and cross-reference mappings.
- [ ] Anime absolute numbering, split cours, daily/date-based shows, sport events, YouTube IDs, collections, anthologies, and release-group filename strategies.
- [ ] Secure secret storage owned by the host; extensions receive opaque request capabilities, never raw stored credentials.

## Stage 3 — Companions, extras, and exports

- [ ] Subtitle language/variant detection, conversion requests, and synchronization workflows.
- [ ] Chapters, fonts, cue sheets, thumbnails, trailers, themes, and alternate-audio companions.
- [ ] Plex, Jellyfin, Emby, and Kodi sidecar profiles.
- [ ] Featurette, interview, deleted-scene, behind-the-scenes, trailer, short, and music-video classification.
- [ ] Custom artwork selection and naming.

## Stage 4 — Read-only inspection and quality control

- [ ] Scoped `media.inspect-summary` command.
- [ ] Codec, bitrate, frame-rate, HDR, aspect-ratio, audio-layout, language, and file-size policies.
- [ ] Fake-4K, letterboxing, interlacing, damaged-stream, and incomplete-season warnings.
- [ ] Duplicate/upgrade comparisons and edition-aware recommendations.
- [ ] Read-only diagnostic panels contributed through host-rendered components.

## Stage 5 — Events, notifications, and import sources

- [ ] Audited lifecycle events for import, match, preview, rename completion, failure, and undo.
- [ ] Home Assistant, webhook, email, Discord, Slack, and other notification adapters.
- [ ] Capability-scoped imports from FetchBox, Sonarr, Radarr, download clients, disc rippers, and archive tools.
- [ ] Authenticated `batch.add`, `batch.preview`, and `extension.status` external commands.

## Stage 6 — Permissioned transformations and destinations

- [ ] Host-mediated remux, subtitle/font/artwork extraction, subtitle conversion, and thumbnail generation.
- [ ] Explicit executable declarations for FFmpeg, HandBrake, FileBot, or other user-approved tools.
- [ ] Hardlink, reflink, copy, move, NAS, removable-media, and separately authenticated cloud destinations.
- [ ] Plex/Jellyfin/Emby refresh requests after completion.
- [ ] Per-command preview, approved roots, timeouts, resource limits, confirmation policy, and undo where possible.

## Stage 7 — Policy and controlled automation

- [ ] Parental, rating, genre, destination, overwrite, volume, and household approval policies.
- [ ] Upgrade/downgrade retention and automated duplicate review rules.
- [ ] Narrowly scoped `batch.execute` grants with visible preview and revocable rules.
- [ ] Signed package/update metadata and publisher identity, while retaining explicit local development packages.
- [ ] Sandboxed code-capable extensions only after isolation, permissions, authentication, auditing, revocation, and recovery are validated together.

## Non-negotiable security rules

The main process owns privileged operations. External access remains off by default and local-only by default. Every message is authenticated, versioned, schema-validated, bounded, rate-limited, and audited. Paths are canonicalized and constrained to user-approved roots. Read-only access and state-changing access are separate capabilities. Installing a package never silently grants new permissions.
