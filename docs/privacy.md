# Privacy

Hz Mixer has no accounts, analytics, telemetry, microphone access or upload endpoint. Audio generation, export encoding and JSON parsing run in the browser. The app sends no current settings, saved mixes, imported JSON or rendered audio to a server.

The hosted version requests its HTML, styles, scripts, icons and enabled recordings from the site host. The MP3 encoder is requested only when needed. [GitHub Pages records visitor IP addresses for security](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). Ordinary hosting request metadata is outside the app's browser-local storage. Clicking external source/credit links opens those sites separately.

Current settings, library (up to 30 mixes), favorites and theme use browser local storage. Legacy keys are retained for compatibility. Clearing site data removes these records. Storage can be unavailable or isolated by browser, origin or file location. No cross-device sync or recovery service is provided. Library JSON downloads are the supported backup/transfer mechanism; review them before sharing because they contain mix names and listening settings.

Generated audio and JSON are saved through your browser's download behavior or an optional native file picker. Their subsequent storage/sync depends on your chosen destination and operating system. Hz Mixer itself does not upload them.

The standalone HTML embeds all required assets, encoder source and licences and makes no runtime network requests. A website visit is not a guaranteed offline installation; no service worker is installed. Moving between website and standalone storage requires JSON export/import. No flashing-light visual experiment is included in the public build.
