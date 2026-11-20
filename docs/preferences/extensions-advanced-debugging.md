# 🧩 Extensions, Advanced & Debugging

These sections cover optional packages, custom detector vocabulary, application information, and developer-only troubleshooting.

[← Preferences overview](../preferences.md) · [Previous: Renaming](renaming.md)

## 🧩 Extensions

Extensions can classify matched media, add library destinations, or connect approved services. Media Renamer works normally with none installed.

Use the folder-plus button to install a package and the folder button to open the extension directory. Every extension begins disabled, and incompatible packages are ignored.

**Enable** lets an installed extension participate after normal metadata matching. Capabilities such as metadata network access or Home Assistant statistics access require a separate grant. Read the stated reason and displayed network origins before granting one.

Directory and text options are stored with normal preferences. Secrets are stored in the operating system credential vault when available; a saved secret is never displayed again. Entering a new value replaces it.

**Uninstall extension** removes an installed package. Development or preinstalled packages may need to be managed at their original source.

Library destinations and filename patterns supplied by an extension live under **Libraries & naming**. They inherit from the regular Shows or Movies tab until customised.

## 🧪 Advanced

### Release-tag and edition aliases

Aliases teach the detector personal vocabulary without replacing built-in rules. Matching is case-insensitive, separator-tolerant, and limited to complete tokens.

Each line uses:

```text
field = filename alias => normalized output
```

Examples:

```text
source = web download => WEB-DL
edition = mindbending => Mind Bending
videoCodec = AVC => H.264
webOrigin = crunchy premium => Crunchyroll | CR
```

Supported fields are `source`, `resolution`, `videoCodec`, `audioCodec`, `channels`, `flag`, `webOrigin`, and `edition`. A web origin can add a short form after `|`.

Errors appear below the editor. Correct them before relying on the alias. **Clear custom aliases** removes only your additions and returns to the built-in vocabulary.

## ℹ️ About

About shows the installed application version and links to the website, repository, privacy policy, and licence. It also records provider notices and the principal open-source foundations.

Click the version seven times to enable developer mode. A remaining-click counter appears after the third click.

Developer mode exposes seasonal theme previews and Debugging. It does not weaken preflight or rename safety.

## 🐛 Debugging

Debugging appears only while developer mode is enabled.

### Workspace simulation

Runs fake filenames through the normal TV or Movie search, matching, editing, and progress interface without touching files on disk. Use it to demonstrate or reproduce a workflow safely.

### Manual notification tests

Sends fixed Success, Stopped, and Failure notifications. The operating system may suppress them because of notification permissions or a Focus mode.

### Audio tests

Plays the current theme’s success and error sounds without running a rename.

### Diagnostic tools

**Debug console** shows session-local provider, matching, and filesystem events. Nothing is uploaded.

**Disable developer mode** closes developer tools and returns Preferences to Advanced.

## 🔐 What not to share

When asking for help, share proposed names and non-private diagnostic events. Never post API keys, access tokens, credential-vault values, or private filesystem paths.
