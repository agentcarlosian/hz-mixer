# Hz Mixer

A browser audio mixer for binaural beats, monaural beats, isochronic pulses, environmental recordings and generated noise. No account, backend, analytics or runtime CDN.

![Hz Mixer in dark mode](docs/images/mixer-dark.png)

## Use Online

**The site is not published yet.** The planned repository is `agentcarlosian/hz-mixer` and the planned GitHub Pages address is `https://agentcarlosian.github.io/hz-mixer/`. This address is not a live-app claim. Publication is a separate, manual maintainer action.

Once published, open the website in a modern browser and press Play. Recordings load only when needed; the MP3 encoder loads only when exporting MP3. Stereo headphones are required for binaural playback. No install is needed.

## Features

- Binaural, monaural, isochronic and nature-only modes.
- Beat rate 0.50-40.00 Hz in 0.01 Hz steps; carrier pitch 20-2000 Hz.
- 37 presets across Delta, Theta, Alpha, Beta, Gamma and nature-only, with search, band/method filters and favorites.
- Fixed rates, linear/smooth sweeps, once/hold or ping-pong, and up to 16 hold/sweep session stages.
- Four field recordings plus white, pink and brown noise; independent level, mute, solo and balance.
- Fade-in/out, crossfaded recording loops, and isochronic width, softness and depth.
- Light, Green, black/purple Dark, Cyberpunk and Matrix themes, plus System; waveform/spectrum monitor, session progress and digital RMS meter.
- Up to 30 named mixes and JSON mix/library backup with previewed import.
- Stereo WAV (16-bit PCM) and MP3 (128/192/256/320 kbps), at 44.1 or 48 kHz, with progress/cancellation and optional direct-to-file saving.

The [mixer guide](docs/mixer-guide.md) explains controls, frequency programs and export limits. Frequency names describe sound, not a guaranteed mental state or health outcome. This is a listening and sound-design tool, not a medical device. Start at a comfortable device volume; the digital meter does not measure acoustic volume at your ears. No flashing-light features are included.

## Local Data and Privacy

Mixing, rendering, encoding and JSON import run in your browser. Hz Mixer does not upload settings, imported JSON or exported audio. Current settings, saved mixes, favorites and theme use local browser storage. Clearing site data removes them. Use a library backup to transfer between browsers, the old Beat Mixer file, the website and the portable app; their storage is separate.

The website requests static files from its host. GitHub Pages records visitor IP addresses for security. There is no service worker or promise that the website works offline after a visit. See the [privacy details](docs/privacy.md).

## Optional Offline Download

When release downloads are published, the portable ZIP will contain `Hz Mixer.html` and its notices/source information. Open the HTML in a modern desktop browser without a local server. It contains all recordings, icons, code, encoder source and licence texts. It makes no runtime network requests and can be used independently of the ZIP's other files. Audio starts only after Play.

From a source checkout, Node.js 24 builds the portable file:

```sh
npm ci --ignore-scripts
npm run build:standalone
```

Node.js is required only for development and packaging, not for listening. Moving/renaming a portable file may create separate browser storage; back up your library first.

## Development

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run dev
```

`npm test` builds both distributions, then runs the Node checks. `npm run dev` builds the web output and previews it at `http://127.0.0.1:5173/`. For another port, first run `npm run build:web`, then `node serve.mjs 5174 --site`. The server binds only to loopback. Stop it with Ctrl+C. Rebuild after source edits.

`_site/` is the explicit, allowlisted Pages output. It contains modular runtime files and lazy-loaded recordings, not the large portable HTML or the repository root.

Browser regression tests use a separate headless Firefox profile, synthetic storage and a temporary server for the built site under `/hz-mixer/`:

```sh
npx playwright install firefox
npm run test:browser
npm run release:prepare
npm run release:verify
```

Reports/screenshots go to ignored `output/browser/`. Portable HTML and release assets go to ignored root `Hz Mixer.html` and `dist/`. See the [release runbook](docs/release.md) for manual acceptance and deployment gates. PR CI is read-only and does not publish. A separate Pages workflow is manual-only, restricted to `main`, and requires the publish checkbox. npm publication is disabled.

## Limits and Verification

Exports are limited to 1 second-2 hours. Export renders a snapshot of current settings from the beginning, not the history of live edits. MP3 is lossy and adds codec delay/padding, so decoded duration can be slightly longer. WAV is the uncompressed reference. Long Blob downloads may use substantial memory; direct-to-file streaming is offered only where the browser supports it. Cancellation waits for the current rendering/decoding block, with shorter yields during MP3 encoding.

Automated checks cover the built web app over loopback HTTP, audio/state behavior, exports, embedded assets and deterministic packaging. Direct file-origin launch, native OS Save As, perceived loop quality and macOS/Safari/mobile listening remain manual acceptance items. Hosted CI and live GitHub Pages have not been run as part of local preparation.

## Licensing

Hz Mixer's original code and artwork use the [MIT License](LICENSE). Recordings remain CC0, Lucide utility icons retain their notices, and the separately replaceable lamejs MP3 encoder remains LGPL-3.0. These terms are not replaced by MIT. Full notices, encoder source and replacement instructions accompany both distributions. See [third-party notices](THIRD_PARTY_NOTICES.md) and [encoder information](vendor/lamejs/README.md).
