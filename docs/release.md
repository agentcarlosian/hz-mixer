# Release Runbook

## Boundary

The primary artifact is portable `Hz Mixer.html`. The repository contains source, tests, documentation and original assets; generated HTML, release archives, dependencies and QA output are ignored by Git. npm publishing is disabled with `private: true`.

The CI workflow only validates source and uploads candidate workflow artifacts. It has read-only repository permissions and no release-publishing/deployment step. A local preparation command never creates a remote, pushes, tags, publishes or deploys.

## Prepare Locally

Use Node.js 24, then run:

```sh
npm ci --ignore-scripts
npm run release:prepare
npx playwright install firefox
npm run test:browser
npm run release:verify
```

Check `package.json`, `package-lock.json`, `CHANGELOG.md` and `docs/releases/v<version>.md` before changing a version. The original source licence must be selected and the root `LICENSE` present; preparation refuses `UNLICENSED`. Asset licences stay separate.

The output directory contains exactly:

- `hz-mixer-<version>.zip`
- `Hz Mixer.html`
- `release-manifest.json`
- `SHA256SUMS.txt`
- `RELEASE_NOTES.md`

ZIP entries are allowlisted and use fixed metadata; source text is normalized to LF. Packaging must reproduce byte-for-byte from the same source and dependencies. There are no absolute machine paths or build timestamps in the manifest. Stale artifacts for another version make verification fail; archive them elsewhere before preparing a different version.

## Clean Checkout Gate

After committing the reviewed source, clone the local repository into a new temporary folder. Run `npm ci --ignore-scripts`, `npm run release:prepare` and compare its `dist/SHA256SUMS.txt` with the primary checkout. This checks that ignored/generated files or ancestor dependencies are not needed for packaging.

## Manual Browser Gate

Before public release, check the release HTML directly from disk in the intended browsers:

1. Confirm Hz Mixer branding and version in the embedded credits.
2. Confirm no autoplay, no runtime network requests, and usable controls at narrow widths.
3. Audition all three methods and ambient loop transitions at comfortable device volume.
4. Test sweeps, pause/resume, stages, fade/stop, noise, mute/solo and balance.
5. Save/reload a mix, and transfer a JSON backup from the old file.
6. Export a WAV using both ordinary download and native Save As where supported; confirm cancellation does not commit a partial file.

Automated browser checks cover editable source over loopback HTTP. The in-app browser automation policy blocks file-origin launching, so this is a real acceptance gap, not an automatically verified property. The streaming writer is tested; the native OS file-save dialog is not automated.

## Publish Only After Authorization

1. Confirm the intended GitHub account/repository, source licence, version and manual acceptance results. Review the local commits' author name/email for public-history privacy before uploading.
2. Obtain explicit approval to create/connect a remote and push. No remote is assumed in this local preparation.
3. Run hosted CI and inspect completed results; local runs alone are not a passed GitHub check.
4. Obtain explicit authorization for the release/tag, then use the reviewed commit and matching version.
5. Use the prepared release notes and attach only verified `dist/` assets. Do not upload QA logs, browser profiles, development directories or saved listening data.

## Evidence and Recovery

Record actual completed checks in `docs/plan.md`. Keep generated QA reports in ignored `output/`, not source history. Checksums detect corruption but are not digital signatures; unsigned local artifacts do not establish publisher identity.

Do not overwrite the old project or its original portable file. Use JSON backup/import for listening-state recovery and regenerate from a reviewed commit for release-artifact recovery. No formal support SLA or hosted service is implied.
