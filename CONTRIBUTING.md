# Contributing

Hz Mixer is a browser-local audio tool with static web and standalone HTML builds. The only runtime library is the explicitly vendored, separately replaceable MP3 encoder. New functionality must not require accounts, a runtime CDN or a backend.

## Setup and Checks

Use Node.js 24. Run `npm ci --ignore-scripts`, `npm run check` and `npm test`. For the editable source preview, run `npm run dev`; it binds to loopback only. Run `npx playwright install firefox` and `npm run test:browser` for the isolated browser suite. On Linux, Playwright may require system packages (`npx playwright install --with-deps firefox`).

`npm run dev` builds the web output and previews it on port 5173. For another port, first run `npm run build:web`, then `node serve.mjs 5174 --site`. Stop the preview with Ctrl+C and rebuild after source edits. The browser suite uses synthetic storage, an isolated headless Firefox profile and the built site under `/hz-mixer/`.

For a release candidate, run `npm run release:prepare`, `npm run test:browser` and `npm run release:verify`. See the [release runbook](docs/release.md) for clean-checkout verification and manual acceptance. PR/push CI validates and stores candidate artifacts; it does not publish. Pages deployment is a separate manual action. npm publication is disabled.

For normal development, modify source and regenerate rather than editing generated `Hz Mixer.html`, `_site/` or `dist/` files. Tests rebuild both distributions automatically. Runtime code lives in `src/`, styling in `styles.css`, and UI markup in `index.html`. Replacing the LGPL encoder in a generated HTML script block is supported; see [encoder replacement instructions](vendor/lamejs/README.md).

The complete guide is maintained in [docs/mixer-guide.md](docs/mixer-guide.md). A pinned, build-only Markdown parser renders it to the website's `guide.html` and the portable app's embedded view. No Markdown parser ships as a runtime dependency. The guide renderer rejects raw HTML and unsafe link schemes. Keep control names, limits and examples aligned with the actual mixer.

## Change Boundaries

- Keep storage/JSON compatibility explicit and never autoplay restored settings.
- Preserve mute/solo precedence and exact stereo routing.
- Audio automation belongs on the audio clock; mixer level edits must not reset a sweep.
- Keep live and offline rendering on the shared signal graph.
- Add focused regression coverage and check small mobile viewports.
- Never add health/mental-state guarantees or fast flashing visuals to this audio-only release.
- Every new recording, image or icon needs verified redistribution terms and a source record.
- Do not include personal paths, sessions, credentials or research data in fixtures, screenshots or archives.

Use the issue templates for reproducible problems and focused feature proposals. No hosted service or formal support response time is promised.
