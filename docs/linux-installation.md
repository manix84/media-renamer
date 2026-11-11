# Install Media Renamer on Linux

Linux releases include the application runtime; users do not need Node.js, npm, Electron, or the source code. Choose the download based on where Media Renamer should keep its data:

| Download | Installation | Where preferences and extensions are stored | Best for |
| --- | --- | --- | --- |
| AppImage | None | The current computer's user profile | Running without installing on one computer |
| Debian package | Installed through the system | The current computer's user profile | Normal Debian or Ubuntu desktop integration |
| RPM package | Installed through the system | The current computer's user profile | Normal Fedora, RHEL, or openSUSE desktop integration |
| USB-portable bundle | None | The bundle's local `data` folder | Carrying the app, preferences, history, and extensions between computers |

The initial packaged-distribution support covers Debian/Ubuntu derivatives, Fedora/RHEL derivatives, and openSUSE. The AppImage remains the fallback for other x86-64 desktop distributions. Additional native package formats can be considered in response to user requests.

## AppImage — install-free, with machine-local data

1. Download the `.AppImage` file for your release.
2. In the file's **Properties**, allow it to run as a program. From a terminal, the equivalent is `chmod +x Media-Renamer-*.AppImage`.
3. Double-click the AppImage to run Media Renamer.

The AppImage executable can be moved and does not require installation, but it is **not the data-portable edition**. Preferences, rename history, caches, and installed extensions are stored in the current computer's user profile. Moving the AppImage to another computer does not carry that data with it.

A desktop integration tool such as AppImageLauncher may optionally add it to the application menu.

## Debian / Ubuntu package

1. Download the `.deb` file for your release.
2. Open it with the system's software installer and select **Install**.
3. Start **Media Renamer** from the application menu.

The command-line equivalent is `sudo apt install ./Media-Renamer-*.deb`. Using `apt` this way lets the system install any required operating-system libraries.

## Fedora / RHEL / openSUSE package

1. Download the `.rpm` file for your release.
2. Open it with the system's software installer and select **Install**.
3. Start **Media Renamer** from the application menu.

On Fedora or RHEL, the command-line equivalent is `sudo dnf install ./Media-Renamer-*.rpm`. On openSUSE, use `sudo zypper install ./Media-Renamer-*.rpm`. Both commands allow the system package manager to install required operating-system libraries.

## USB-portable bundle — carries its data

1. Download and extract the `linux-x86_64-portable.tar.gz` file onto the USB stick.
2. Keep **Media Renamer.AppImage**, **Run Media Renamer.sh**, and the **data** folder together.
3. Run **Run Media Renamer.sh**. If needed, allow both the launcher and AppImage to run as programs in their file properties.

No dependency installation is required: the launcher uses AppImage extract-and-run mode and does not need FUSE, `apt`, Node.js, or Electron. Unlike the standard AppImage, it stores preferences, rename history, caches, and installed extensions inside the adjacent `data` folder. Keep the whole extracted bundle together and those settings will be available when it is run on another supported Linux computer.

Extension credentials are the exception: they use operating-system encryption and may need to be entered again on another computer. A USB drive mounted with execution disabled cannot run Linux applications directly; copy the folder to a Linux filesystem or remount the drive with execution allowed.

## Extensions

Open **Preferences → Extensions** in Media Renamer. Use **Install extension** to choose a downloaded extension folder, or select **Open extensions folder** to see the personal extension location, a short guide, and a starter manifest.

This personal folder is kept outside the installed application, so application upgrades do not remove user-installed extensions. Every extension starts disabled and must be enabled explicitly in Preferences.

## Build the Linux installers

On an x64 Linux build machine with Node.js 22 installed:

```bash
npm ci
npm run package:linux
npm run package:linux:portable
```

The AppImage, Debian package, RPM package, and portable archive are written to `release/`. The tagged GitHub release workflow runs the same packaging stack on Ubuntu and publishes all four formats.
