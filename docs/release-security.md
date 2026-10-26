# Self-contained release security plan

Media Renamer releases must remain self-contained: normal TV and movie matching runs on the user's machine without a Media Renamer server and without asking the user to configure provider credentials. GitHub Pages may host signed public release metadata, but it cannot execute a credentialed relay or protect a secret.

## Provider boundary

- TMDB is the zero-configuration default for released TV and movie workflows. A dedicated, read-only application token is injected by the trusted release workflow and is independently revocable.
- AniList remains available for applicable anime metadata without introducing a Media Renamer credential.
- TVDB is optional. Released artifacts must never contain a shared subscriber PIN. Users may configure their own eligible credentials for TVDB-specific ordering or metadata.
- The application must include all required provider attribution and pass a licensing review before its first public release.

## Threat model

The hardening work protects against accidental disclosure, archive inspection, JavaScript searches, ordinary string scanning, renderer compromise, simple repackaging, and casual modification. It also limits the damage from application bugs and release-pipeline compromise.

It does not claim that a shared client-side credential is cryptographically secret. A determined user controlling the machine can attach a debugger, instrument networking APIs, or inspect process memory while the credential is in use. The objective is to raise the cost of extraction, constrain credential privileges, detect accidental exposure, and make rotation routine.

## Credential containment

1. Keep the TMDB token out of the repository, application JavaScript, renderer/preload APIs, logs, telemetry, crash reports, URLs, and ordinary packaged resources.
2. Inject it from a protected GitHub Actions environment independently for each platform build.
3. Use a stripped native helper to reconstruct the token briefly, build only fixed-origin and fixed-operation requests, and return normalized metadata.
4. Generate a different encoded representation and split for every release. Clear temporary plaintext buffers where the platform permits.
5. Assign each credential a non-secret release identifier so abnormal use can be traced and the correct token revoked without exposing it.
6. Cache responses and impose bounded concurrency and local request throttling to prevent accidental provider abuse. Treat these as safety controls, not an unbypassable security boundary.

## Application hardening

- Explicit Chromium sandboxing, context isolation, no renderer Node integration, strict IPC schemas, and a narrow preload surface.
- A restrictive Content Security Policy and denial of unexpected navigation, new windows, downloads, and permission requests.
- ASAR integrity and `OnlyLoadAppFromAsar`, with RunAsNode, NODE_OPTIONS, and command-line inspection fuses disabled in production.
- Minified production main-process code, no production source maps, stripped native symbols, and no development packages or examples in installers unless intentionally shipped.
- Signed Windows artifacts and signed/notarized macOS artifacts. Signatures establish publisher and integrity; they do not conceal credentials.

## Release-chain controls

- Pin third-party GitHub Actions to immutable commit SHAs and grant write permission only to the publishing job.
- Use a protected release environment and approval before publication.
- Run tests, dependency audit, secret scan, and installer-content inspection before release publication.
- Extract every produced installer and fail when it contains the literal credential, known encoded forms, `.env` files, source maps, or unexpected development assets.
- Generate an SBOM, build-provenance attestation, SHA-256 checksums, and signed release artifacts.

## GitHub Pages boundary

A Pages site may publish a signed static manifest containing supported and revoked versions, release checksums, provider availability notices, public verification keys, and update metadata. The application verifies that manifest with an embedded public key.

Pages must never contain an API token, encrypted API token with a client-held decryption key, subscriber PIN, or endpoint that claims to relay credentialed requests. Static publication cannot keep those values secret.

## Release acceptance criteria

A public release is ready only when:

- a clean installation can perform the default metadata workflow without user credential setup;
- no shared TVDB subscriber PIN is present;
- provider credentials never cross into renderer state or IPC responses;
- extracted installers pass credential and development-artifact scans;
- tampered application archives fail integrity validation on supported platforms;
- provider failure, throttling, or credential revocation produces a recoverable user-facing error;
- the credential rotation procedure has been exercised with a test token; and
- documentation states both the protections in place and the unavoidable client-side extraction limitation.
