# Install Media Renamer on Linux

Linux releases are available in two formats. Both include Media Renamer and its application runtime; users do not need Node.js, npm, Electron, or the source code.

## AppImage (simplest)

1. Download the `.AppImage` file for your release.
2. In the file's **Properties**, allow it to run as a program. From a terminal, the equivalent is `chmod +x Media-Renamer-*.AppImage`.
3. Double-click the AppImage to run Media Renamer.

The AppImage is portable and does not require installation. A desktop integration tool such as AppImageLauncher may optionally add it to the application menu.

## Debian / Ubuntu package

1. Download the `.deb` file for your release.
2. Open it with the system's software installer and select **Install**.
3. Start **Media Renamer** from the application menu.

The command-line equivalent is `sudo apt install ./Media-Renamer-*.deb`. Using `apt` this way lets the system install any required operating-system libraries.

## Extensions

Open **Preferences → Extensions** in Media Renamer. Use **Install extension** to choose a downloaded extension folder, or select **Open extensions folder** to see the personal extension location, a short guide, and a starter manifest.

This personal folder is kept outside the installed application, so application upgrades do not remove user-installed extensions. Every extension starts disabled and must be enabled explicitly in Preferences.

## Build the Linux installers

On an x64 Linux build machine with Node.js 22 installed:

```bash
npm ci
npm run package:linux
```

The AppImage and Debian package are written to `release/`. The tagged GitHub release workflow runs the same packaging stack on Ubuntu and publishes both formats.
