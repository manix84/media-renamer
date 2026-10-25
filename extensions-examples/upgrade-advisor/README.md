# Duplicate and upgrade advisor example

**Status: Design example — Stage 4.**

This extension type compares an incoming match with host-supplied library candidates. It can rank resolution, source, codec, HDR, audio, languages, edition, and completeness, then recommend keep, replace, retain-both, or review.

Recommendations are read-only. The host never deletes or replaces an existing library item solely because an extension recommends it, and differing editions default to preservation.
