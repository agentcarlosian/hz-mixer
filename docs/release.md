# Release Runbook

## Boundaries

The primary public entry point is [Hz Mixer](https://agentcarlosian.github.io/hz-mixer/). Verify the live HTTPS site after every deployment. `_site/` is the only Pages upload directory; never upload the repository root, `dist/` or the portable HTML as the homepage.

The optional portable download is `Hz-Mixer.html`; the local build and the copy inside the ZIP remain `Hz Mixer.html`. The download name avoids GitHub's release-asset filename normalization and matches the external checksum list. `dist/` contains the verified ZIP, HTML, manifest, checksum list and release notes. Dependencies, generated outputs and local QA evidence are ignored. npm publication is disabled. Local preparation never creates a remote, pushes, tags or deploys.

PR/push CI is read-only and stores candidate artifacts. The separate Pages workflow has only `workflow_dispatch`, requires its publish checkbox and `main`, and grants Pages/OIDC write permission only to the deploy job. Configure the `github-pages` environment's allowed branch as `main` and required reviewers where your plan supports them **before enabling deployment**. This repository cannot configure those hosted protections locally.

## Prepare Locally

Use Node.js 24:

```sh
npm ci --ignore-scripts
npm run release:prepare
npx playwright install firefox
npm run test:browser
npm run release:verify
```

The built-site regression suite serves the actual `_site/` at `/hz-mixer/`. Check version metadata, relative resource URLs, lazy loading, Info/Guide/Credits/Privacy, the listening warning and exports. ZIP verification checks the exact allowlist, source bytes, hashes, documentation links and deterministic metadata. Source text is LF-normalized; vendored encoder/source bytes are preserved. `dist/` must contain exactly:

- `hz-mixer-<version>.zip`
- `Hz-Mixer.html`
- `release-manifest.json`
- `SHA256SUMS.txt`
- `RELEASE_NOTES.md`

Headless Linux browser jobs provision a per-user PulseAudio null sink before running the suite, so Firefox has an output device for its real-time audio clock. This does not mock Web Audio, bypass autoplay policy or skip playback assertions. The same setup is used by the validation and manual Pages workflows. Local Linux test environments also need a working audio output or a virtual sink; regular app users do not need this CI setup.

`release:verify` also regenerates expected web/portable content in memory from current source and compares it with the existing outputs. It rejects stale runtime edits and missing, changed or extra web files without rewriting those outputs. Run `npm run build` before preparing new release artifacts after a source change.

ZIP documentation preserves its original paths, including recording/icon notices and the separately replaceable encoder, full GNU licence texts and exact upstream source archive. The HTML independently embeds the same notices/source download. The [encoder instructions](../vendor/lamejs/README.md) explain replacement and rebuilding. MIT covers only original code/artwork.

After committing reviewed changes, clone locally into a clean temporary directory, install locked tools and run `npm run release:prepare`. Compare `dist/SHA256SUMS.txt` with the primary checkout. Generated or ancestor files must not be required. Changing a version requires aligned package/lock/changelog/release notes and removal or archival of stale generated artifacts.

## Manual Acceptance

1. Open the portable HTML directly from disk in intended browsers; check no autoplay/network dependencies and embedded credits/version.
2. Audition all methods and environmental loop transitions at comfortable volume.
3. Check pause, sweep/stages, fades/Stop, mute/solo, pan and JSON backup/import. Open Info and the full guide; return to the mixer and confirm current audio/settings are unchanged. Check the safety notice in Info and the embedded offline guide's section links and Back navigation. Reset should return to a tone-only mix with every recording, noise channel and bell off.
4. Export WAV and MP3 through download and native Save As where supported. Test cancellation before Finalizing and confirm no completed partial audio file is saved. During Finalizing, confirm Cancel is disabled, Escape keeps the dialog open, and success or commit failure restores usable controls.
5. Check mobile/Safari/macOS listening before claiming support there. Responsive automated layouts are not listening validation.

Automated Firefox checks use loopback HTTP, not file-origin playback. The native OS picker and perceptual loop quality are not automated. Hosted CI/live Pages are separate checks, not implied by local success.

## Private Repository Review

1. Review candidate files and all history that will be pushed, including deleted files, Git author/email, recordings, artwork and notices. Do not silently rewrite authors or history. Ignoring or deleting a file does not remove older committed copies.
2. Obtain maintainer approval before creating/connecting `agentcarlosian/hz-mixer` and pushing. A private repository can be used to review rendered docs, hosted CI and candidate artifacts before public release.
3. Leave Pages undeployed during private review. A private repository is not a guarantee of a private website; [GitHub Pages sites can be publicly accessible even when their repository is private](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).
4. Inspect completed Linux/Windows CI results and download the candidate artifacts for acceptance. Check the README images and documentation links as rendered on GitHub.
5. Review Actions logs and artifacts before changing visibility. [Actions history and logs become visible when a repository becomes public](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).

## Public Release and Pages

1. Change repository visibility only after maintainer approval and private review. Recheck hosted protections after the change.
2. Configure Pages source as GitHub Actions and protect the `github-pages` environment. Obtain approval to deploy, then manually run the Pages workflow on reviewed `main` with its publish checkbox.
3. Verify the real HTTPS project URL, embedded/dedicated guide, assets, browser console, audio and export before adding an active website link to the README.
4. Add the verified website, offline-release download and guide links near the top of the README. Do not add dead download links or unpublished-site placeholders.
5. Obtain separate release/tag approval and attach only matching verified `dist/` assets.

Keep QA logs, profiles, saved listening data and internal design drafts out of uploads. Checksums detect corruption, not publisher identity; they are not digital signatures. Keep the old project intact and use JSON backups for recovery. No backend or support SLA is implied.

Local investigations and internal preparation diaries belong under ignored `output/`, never in deployment or release archives. The exact site/ZIP allowlists are the publication boundary; do not add diagnostic tools or their evidence to them.
