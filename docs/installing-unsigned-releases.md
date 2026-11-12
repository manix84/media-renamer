# Installing unsigned releases

Media Renamer is free software and its current releases are not signed with paid Apple or Microsoft certificates. Download releases only from the [official GitHub repository](https://github.com/manix84/media-renamer/releases).

Every release includes `SHA256SUMS.txt` and GitHub build provenance. Checksums detect a changed or incomplete download; provenance links an artifact to this repository's release workflow. Neither is a substitute for operating-system code signing, but both provide independently verifiable integrity without a paid certificate.

## macOS

macOS will report that it cannot verify the developer because the app is not notarised. Do not disable Gatekeeper globally and do not run copied `xattr` commands.

1. Move **Media Renamer** into Applications and try to open it once.
2. Open **System Settings → Privacy & Security**.
3. Find the blocked Media Renamer message and select **Open Anyway**.
4. Confirm **Open**. macOS remembers that decision for this copy of the app.

Apple documents this exception flow in [Open apps safely on your Mac](https://support.apple.com/en-gb/102445).

Verify the download first from Terminal, substituting the downloaded filename:

```sh
shasum -a 256 "Media Renamer-0.4.0-mac-arm64.dmg"
```

Compare the result with that filename's entry in `SHA256SUMS.txt` on the same GitHub release.

## Windows

Windows Defender SmartScreen may report **Windows protected your PC** because the installer and portable executable are not yet signed and have limited download reputation.

1. Download only from the official GitHub release.
2. Verify the SHA-256 checksum before running it.
3. If the checksum matches, open the file, select **More info**, and then **Run anyway**.

In PowerShell, substituting the downloaded filename:

```powershell
Get-FileHash '.\Media Renamer-0.4.0-win-x64-setup.exe' -Algorithm SHA256
```

Compare the result with that filename's entry in `SHA256SUMS.txt`.

The project intends to apply to [SignPath Foundation](https://signpath.org/) for free Windows signing for qualifying open-source projects. Until approval and integration are complete, Windows releases remain explicitly unsigned.

## Linux

Verify any AppImage, DEB, RPM, or portable archive with:

```sh
sha256sum "Media Renamer-0.4.0-linux-x86_64.AppImage"
```

Compare the result with `SHA256SUMS.txt` before installing or running it.

## GitHub build provenance

With the GitHub CLI installed, a release artifact can also be checked against this repository's signed build attestation:

```sh
gh attestation verify "<downloaded file>" --repo manix84/media-renamer
```
