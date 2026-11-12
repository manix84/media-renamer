# Code signing policy

## Status

Windows releases are currently unsigned. Media Renamer intends to apply for free open-source code signing through SignPath Foundation. This policy describes the controls that will apply after acceptance and will be updated when signing becomes active.

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

macOS releases are not covered by SignPath and remain unsigned because Apple does not provide free Developer ID certificates. Linux releases use published checksums and build provenance rather than an operating-system publisher certificate.

## Project and licence

Media Renamer is maintained in the public [`manix84/media-renamer`](https://github.com/manix84/media-renamer) repository and released under the [MIT License](../LICENSE).

## What will be signed

- The official Windows NSIS installer produced by this repository's GitHub Actions release workflow.
- The official Windows portable executable produced by the same workflow.
- Project-owned Windows executables included in those packages, where the signing configuration permits it.

Only artifacts built from this repository by the trusted release workflow may be submitted for signing. Locally built files, pull-request artifacts, forks, extensions, third-party executables, and modified packages are outside this policy.

## Release controls

- Release builds originate from the public repository and a versioned commit on `main`.
- The workflow runs automated tests before packaging.
- Every signing request must pass SignPath origin verification and its configured release policy.
- A project approver must review any signing request that requires manual approval.
- Published artifacts include SHA-256 checksums and GitHub build-provenance attestations.
- A suspected signing compromise will stop releases while the request, workflow, and affected artifacts are investigated. SignPath will be asked to revoke affected signatures or certificates where appropriate.

## Team roles

- **Committer and reviewer:** [Rob Taylor (`manix84`)](https://github.com/manix84). Contributions from anyone without direct commit access require review before merging.
- **Approver:** [Rob Taylor (`manix84`)](https://github.com/manix84). The approver is responsible for confirming that a signing request belongs to an intended Media Renamer release.

These roles will be updated before access is granted to another maintainer.

## Privacy and network access

Media Renamer contains no advertising, behavioural analytics, or telemetry. File paths, preferences, rename history, and extensions remain on the user's computer.

The application makes network requests when the user uses metadata features. Search terms, provider identifiers, and the minimum request data required for the chosen feature are sent to the configured metadata provider, such as TMDB, TheTVDB, or AniList. Those services process requests under their own privacy policies. Media Renamer does not send local media files, rename history, or unrelated filesystem information to those providers.

GitHub may process ordinary connection information when a user visits the repository or downloads a release. Signing and release infrastructure may process build metadata needed to verify and sign official artifacts.

## Reporting concerns

Security concerns should be reported through [GitHub private vulnerability reporting](https://github.com/manix84/media-renamer/security/advisories/new), as described in the repository's [security policy](../SECURITY.md).
