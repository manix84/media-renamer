# Destination adapter example

**Status: Design example — Stage 6.**

Destination adapters request host-owned copy, move, hardlink, reflink, NAS, removable-media, media-server, or cloud output. The reference local adapter will choose between copy and hardlink based on validated volume capabilities.

Each destination has explicit approved roots and credentials. The host canonicalizes paths, prevents traversal and unsafe overwrites, verifies results, and exposes only operations it can preview and audit.
