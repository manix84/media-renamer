# Extensions

Media Renamer has an installable, versioned extension system. The application runs normally with no extensions, and every installed package is disabled until the user enables it.

The complete authoring guide, manifest reference, installation layouts, development workflow, supported host commands, security model, and illustrated walkthrough live in [`extensions/README.md`](../extensions/README.md).

Version 1 packages are declarative rather than executable. They may classify normalized provider metadata, display host-rendered badges and settings, and route shows or movies to a selected library root. They cannot run JavaScript or shell commands, use Electron, access the network or filesystem, or bypass preview, preflight, collision handling, logging, and undo.

The working Anime example is a development package at [`extensions-dev/anime`](../extensions-dev/anime/). It is not statically compiled into the core extension runtime and is not required in a normal release.
