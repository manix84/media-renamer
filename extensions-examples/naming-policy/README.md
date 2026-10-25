# Filename and folder policy example

**Status: Runnable for template policies in API v1; specialized numbering remains Stage 2.**

A naming-policy extension selects host-owned folder and filename templates for matching media. The [`compact-bluray-movies`](compact-bluray-movies/) example supplies safe default templates while leaving them editable. Anime absolute numbering, localized titles, collection chronology, and date-based programmes require future metadata and matching capabilities.

Extensions will reference validated template settings and approved variables. They will not construct arbitrary destination paths or write files directly. The host remains responsible for invalid-character normalization, byte limits, collision handling, previews, and undo.
