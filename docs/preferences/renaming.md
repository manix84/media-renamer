# 🔄 Renaming Preferences

Renaming preferences control source cleanup, generated Plex sidecars, confirmation, progress, and what happens after a completed operation.

[← Preferences overview](../preferences.md) · [Previous: Libraries & naming](libraries-and-naming.md) · [Next: Extensions & Advanced →](extensions-advanced-debugging.md)

## 🧹 File moves

These settings apply only when the batch is set to **Move files**. They do not affect an in-place rename.

### Clear source junk after moving

Removes recognised promotional text files, plaintext release-report NFOs, screenshot folders, known promotions, and empty subtitle files.

This cleanup cannot be undone. Leave it off until you have checked that Media Renamer’s detector matches the contents of your source folders. Unknown files and non-empty unlabelled subtitles are preserved.

### Remove empty source folders

Removes directories left empty after media and companion files move successfully. Any folder that still contains a file is preserved.

## 🖼️ Plex metadata sidecars

**Export NFO files** creates movie, series, episode, and multi-episode NFO metadata as part of the rename plan.

**Download Plex artwork** saves available provider posters, backgrounds, logos, banners, season posters, and episode thumbnails using Plex-compatible local asset names.

Both are off by default. Generated sidecars take part in preflight, the operation log, and Undo. Existing destinations are preserved rather than silently overwritten.

## ✅ After renaming

### Clear completed batches automatically

Removes a fully successful batch from the workspace. The internal operation history remains, so Undo is still available.

### Play a sound when finished

Plays the current colour theme’s success or error sound after an operation. Seasonal themes may use their own chime.

### Show a system notification when finished

Asks the operating system to report completed, stopped, or failed operations. Notification permissions and Focus/Do Not Disturb modes can suppress it.

### Confirm before renaming

Shows a final summary and requires approval before files change. Keeping this enabled is strongly recommended.

### Show detailed progress while renaming

Opens the progress dialog automatically. Turn it off to watch the same operation directly in the file list.

### Show a completion report

Summarises processed files, removed folders, warnings, and logs at the end of an operation.

### Close completion reports automatically

Dismisses the report after 30 seconds unless you close it first or add more media. It has no visible effect when completion reports are disabled.

### Save a timestamped operation log

Writes an additional JSON copy outside the app’s internal undo history. A failure to write this optional copy does not make an otherwise successful rename fail.

Use **Operation log folder** to keep copies in one location. If it is empty, Media Renamer uses the active TV/Movie destination or the renamed files’ common folder.

## 🛡️ Recommended safety setup

Keep **Confirm before renaming** and **Show a completion report** enabled. Leave destructive junk cleanup off for the first few batches. Detailed progress is useful for large cross-filesystem moves; file-list progress is calmer for quick in-place renames.
