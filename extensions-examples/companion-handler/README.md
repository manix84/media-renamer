# Companion handler example

**Status: Design example — Stage 3.**

Companion handlers propose associations for subtitles, fonts, chapters, cue sheets, thumbnails, alternate audio, themes, and artwork. A subtitle example could detect language and Forced/SDH variants before proposing Plex-compatible names.

The extension receives bounded metadata rather than unrestricted directories. The host verifies every source and destination, prevents overwrites, displays ambiguous associations, and includes accepted companions in the reversible rename plan.
