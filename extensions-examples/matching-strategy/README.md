# Matching strategy example

**Status: Design example — Stage 2.**

Matching strategies interpret already imported filenames and normalized metadata without changing files. Planned examples cover anime absolute numbering, split cours, daily shows, sporting events, YouTube IDs, anthologies, and release-group conventions.

The host supplies bounded text and structured candidates. Strategies return scored candidates plus human-readable evidence. Low-confidence or conflicting results remain visible for review; an extension cannot silently confirm its own result.
