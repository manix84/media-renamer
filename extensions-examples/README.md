# Media Renamer extension examples

This directory is the extension SDK example catalogue. Media Renamer **never auto-discovers this directory**, so examples do not become part of development or release builds merely because they exist in the repository.

To try a runnable example, either install its directory from **Preferences → Extensions** or copy it into `extensions-dev/` while developing. Do not point `MEDIA_RENAMER_DEV_EXTENSIONS` at this whole catalogue unless you intentionally want every runnable example loaded.

## Example status

Every example README uses one of these labels:

- **Runnable** — supported by the current extension API and contains `media-renamer-extension.json`.
- **Design example** — documents a planned, security-reviewed host capability. It cannot be installed and must not use the installable manifest filename.
- **Contract example** — illustrates a supported declaration whose live privileged execution is not exposed yet. It uses a filename such as `manifest.example.json`, never the installable manifest filename.

## Extension types

| Type | What it contributes | Example | Roadmap stage |
| --- | --- | --- | --- |
| Library routing | Classification, badges, settings, and alternate library roots | [`library-routing/documentary-libraries`](library-routing/documentary-libraries/) | 1 |
| Presentation and review | Warnings, colours, filters, and explanations | `presentation-review` | 1 |
| Filename and folder policy | Specialized templates and numbering policies | `naming-policy` | 1–2 |
| Metadata adapter | Provider search, details, artwork, and cross-references | [`metadata-adapter/anilist`](metadata-adapter/anilist/) | 2 |
| Matching strategy | Absolute/date/event numbering and source-specific parsing | `matching-strategy` | 2 |
| Companion handler | Subtitle, chapter, font, audio, and sidecar association | `companion-handler` | 3 |
| Extras classifier | Featurettes, trailers, deleted scenes, and other Plex extras | `extras-classifier` | 3 |
| Metadata exporter | Plex, Jellyfin, Emby, or Kodi sidecar profiles | `metadata-exporter` | 3 |
| Inspector and quality policy | Read-only media facts and quality warnings | `quality-inspector` | 4 |
| Duplicate and upgrade advisor | Edition and quality comparisons | `upgrade-advisor` | 4 |
| Event subscriber | Audited import, preview, completion, failure, and undo events | `event-subscriber` | 5 |
| Notification adapter | Home Assistant, webhook, email, or chat notifications | `notification-adapter` | 5 |
| Import source | FetchBox, Sonarr, Radarr, download-client, or disc-rip imports | `import-source` | 5 |
| Transformation | Host-mediated remux, extraction, conversion, or thumbnails | `transformation` | 6 |
| Destination adapter | Hardlink, reflink, NAS, removable, server, or cloud output | `destination-adapter` | 6 |
| Policy and approval | Ratings, destinations, overwrite rules, and household approval | `policy-approval` | 7 |

## Rules for examples

1. Never put an unsupported capability in `media-renamer-extension.json`.
2. Use neutral paths and fake credentials.
3. State every requested capability and its security impact.
4. Keep privileged work host-owned; an example never receives Electron, Node, shell, or unrestricted filesystem access.
5. Include positive, negative, disabled, malformed, and permission-denied test cases when the capability becomes runnable.
6. Examples must pass the same manifest validation as third-party packages.

See the [authoring guide](../extensions/README.md) and [ordered roadmap](../extensions/ROADMAP.md) for the live contract.
