# Metadata exporter example

**Status: Design example — Stage 3.**

Metadata exporters convert normalized matched metadata into host-approved sidecars. Planned profiles include Plex, Jellyfin, Emby, and Kodi NFO and artwork naming.

Extensions provide a versioned output description or template; the host validates target names, downloads bounded assets through its network layer, stages files, previews them, and records them in undo. Export remains optional and off by default.
