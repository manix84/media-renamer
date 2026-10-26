# Contributing to Media Renamer

Thanks for helping improve Media Renamer.

## Before opening a change

- Search existing issues and pull requests before starting overlapping work.
- Open an issue first for substantial product or security-boundary changes.
- Never include API keys, tokens, private paths, media-library names, or copyrighted media samples.
- Keep changes focused and preserve the confidence-first review and safe-execution guarantees.

## Development

Use a current Node.js release and install `ffprobe` from FFmpeg for media inspection.

```sh
npm ci
cp .env.example .env
npm run dev
```

Provider credentials in `.env` are local development values and must never be committed.

Before opening a pull request, run:

```sh
npm run check
git diff --check
```

Update tests and documentation with behavioural changes. Add user-visible changes to the **Unreleased** section of `WHATSNEW.md`.

## Pull requests

Explain the problem, the chosen approach, verification performed, and any remaining limitations. Include screenshots for visible UI changes, with private filenames and paths removed. By contributing, you agree that your contribution is provided under the repository's license.
