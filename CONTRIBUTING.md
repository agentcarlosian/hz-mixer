# Contributing

Hz Mixer is a local, browser-based audio tool. Keep runtime behavior dependency-free and usable from a single HTML file. New functionality must not require accounts, remote asset loading or a backend.

## Setup and Checks

Use Node.js 24. Run `npm ci --ignore-scripts`, `npm run check` and `npm test`. For the editable source preview, run `npm run dev`; it binds to loopback only. Run `npx playwright install firefox` and `npm run test:browser` for the isolated browser suite. On Linux, Playwright may require system packages (`npx playwright install --with-deps firefox`).

Do not edit generated `Hz Mixer.html` or `dist/` files by hand. Modify source and regenerate. Tests rebuild the standalone automatically. Runtime code lives in `src/`, styling in `styles.css`, and UI markup in `index.html`.

## Change Boundaries

- Keep storage/JSON compatibility explicit and never autoplay restored settings.
- Preserve mute/solo precedence and exact stereo routing.
- Audio automation belongs on the audio clock; mixer level edits must not reset a sweep.
- Keep live and offline rendering on the shared signal graph.
- Add focused regression coverage and check small mobile viewports.
- Never add health/mental-state guarantees or fast flashing visuals to this audio-only release.
- Every new recording, image or icon needs verified redistribution terms and a source record.
- Do not include personal paths, sessions, credentials or research data in fixtures, screenshots or archives.

Contribution discussion and GitHub issue handling begin only after the repository is published. No hosted service or formal support response time is promised.
