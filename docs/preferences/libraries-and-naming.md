# 📚 Libraries & Naming

This section has separate **Shows** and **Movies** tabs. Enabled extensions may add tabs that inherit these settings.

[← Preferences overview](../preferences.md) · [Previous: General](general.md) · [Next: Renaming →](renaming.md)

## 📺 Shows

### Episode order

**TVDB Aired (Plex-compatible)** is the fixed source for episode numbering and titles. This prevents silent season or episode shifts when a Plex library also uses TVDB aired ordering.

TMDB still supplies show search, artwork, and supporting metadata. If TVDB credentials are not configured, Media Renamer shows a warning and cannot complete show sorting.

### Episode matching

**Match episode names** lets title similarity support or challenge the number found in a filename. Keep it enabled for most libraries: it can match sparse names and exposes conflicts such as a file numbered for one episode but titled like another.

**Automatic confirmation** sets the confidence required to accept a match without review. The default 80% is a practical balance. Raise it for more manual review. Lower it only when filenames are consistently reliable and you have checked the results carefully.

When a show is active, **Save rule** stores its current title-matching and threshold choices. Updating or removing the rule changes future batches for that show without altering the global default.

### Episode naming

**Compact multi-episode names** cleans repeated part markers when one file contains several episodes. “Story Part 1” and “Story Part 2” can keep their full episode range while using the shared title once.

Turn it off to preserve provider titles exactly. A single-episode file always keeps its original title, including a part marker.

### Show destination

**TV base folder** is the library root used when the batch is set to **Move files**. When empty, Media Renamer creates the show folder beside each source.

**Show folder pattern** controls the path beneath that root. It supports show name, year, TVDB ID, season number, and `seasonFolder`, which produces values such as “Season 5” and “Specials”.

The Season and Specials previews show the exact structure. An invalid pattern blocks the rename plan.

### Episode filename template

This template controls the new video filename and matching names for companion files. It supports show, episode, release, technical, and audio fields, plus conditional and repeating Mustache-style sections.

Whitespace and indentation collapse into a single filename space, so you can lay the template out like a readable script. Use **Reference** to see every field and check both Single and Merged examples.

**Save favourite** stores a valid template. A favourite can be applied, updated from the editor, renamed, or deleted. **Reset** restores the built-in default.

## 🎬 Movies

### Metadata agent

TMDB currently supplies movie search, artwork, and metadata. The disabled selector documents the provider in use; it is not an error.

### Movie destination

**Movie base folder** is the root used with **Move files**. When empty, each movie folder is created beside its source.

**Movie folder pattern** supports title, year, edition, collection, TMDB ID, IMDb ID, and nested-folder fields. The Output preview shows the exact destination. Collection fields can group related films without forcing every film into a collection.

### Movie filename template

The movie template controls the new filename and supports movie identity, editions, technical tags, audio languages, and release metadata. The Output preview updates immediately; invalid syntax blocks the plan.

Movie favourites have the same Save, Apply, Update, Rename, Delete, and Reset behaviour as show favourites.

## ✨ Extension library tabs

An enabled extension can add a library tab. Its destination and templates inherit from Shows or Movies until customised.

**Customize** creates an extension-specific value. **Use inherited** or the restore button removes the override, allowing later parent changes to flow through again.

The interface identifies whether each value is inherited, supplied as an extension default, or customised.

## 🧪 Before relying on a template

Read every on-screen path and filename preview, then try a small batch. Templates change proposed names only; no source file changes until the full plan passes preflight and you confirm the rename.
