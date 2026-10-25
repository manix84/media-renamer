# Import source example

**Status: Design example — Stage 5.**

Import-source extensions submit files or folders to a batch through authenticated `batch.add` and request a non-mutating `batch.preview`. Planned examples include FetchBox, Sonarr, Radarr, download clients, and disc-rip tools.

The local API is off by default. Requests require a revocable credential, declared roots, canonical paths, strict schemas, rate limits, replay protection, and audit records. Import never implies permission to execute a rename.
