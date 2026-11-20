# ⚙️ Media Renamer Preferences

Preferences control how Media Renamer looks, matches files, builds names, moves media, and reports completed work. Open them with the **gear button** in the top-right corner of the app.

Changes are saved automatically. You can adjust most options at any time, but always review the current filename and destination previews before starting a rename.

[← Back to the README](../README.md)

## 🚀 A good first setup

You do not need to configure everything before using Media Renamer. For a safe first batch:

1. Leave **Confirm before renaming** enabled.
2. Choose a TV base folder and/or Movie base folder if files should move into a library.
3. Keep the supplied naming templates until you have reviewed their examples.
4. Leave **Automatic confirmation** at 80% and **Match episode names** enabled.
5. Keep destructive cleanup options off until you have tested a few batches.
6. Start with a small group of files and read the preflight summary before selecting **Rename**.

## 🧭 Choose a guide

### [🌍 General preferences](preferences/general.md)

Language, Light/Dark appearance, colour and seasonal themes, file-list density, automatic progress scrolling, and reusable batch queues.

### [📚 Libraries & naming](preferences/libraries-and-naming.md)

TVDB episode ordering, matching confidence, multi-episode naming, TV and Movie destinations, folder patterns, filename templates, favourites, and inherited extension library settings.

### [🔄 Renaming preferences](preferences/renaming.md)

Source cleanup, empty folders, Plex NFO and artwork sidecars, confirmation, progress, completion sounds and notifications, reports, and external operation logs.

### [🧩 Extensions, Advanced & Debugging](preferences/extensions-advanced-debugging.md)

Installing extensions, reviewing permissions, secure secrets, custom release-tag aliases, About, developer mode, simulations, manual notification/audio tests, and the local debug console.

## 🗂️ What appears in the app

The Preferences navigation contains:

- **General** — appearance and file-list behaviour.
- **Libraries & naming** — destinations and templates.
- **Renaming** — moves, sidecars, and completion behaviour.
- **Extensions** — optional integrations.
- **Advanced** — aliases and power-user settings.
- **About** — version, links, privacy, credits, and licences.
- **Debugging** — developer-only simulations and diagnostics.

## 🧯 If a setting gives an unexpected result

Do not start the rename. Switch the file list to **Detailed**, inspect the original and proposed paths, and open the relevant template preview.

You can reset a template, clear a destination, remove a show-specific rule, or clear custom aliases without changing source media. For a reproducible problem, developer mode offers a disk-free workspace simulation and a session-local debug console.
