# Third-party Notices

Hz Mixer's original-source licence is selected separately. These bundled assets keep their own terms; an original-source licence does not replace them.

## Field Recordings

The four MP3 recordings are by Joseph Sardin / BigSoundBank and were identified as CC0 1.0 at the recorded source pages. Attribution is optional under CC0; credit and provenance are retained here and inside the standalone app.

The [audio source manifest](assets/audio/SOURCES.md) records the exact source URLs, download date, licence and SHA-256 of each original file. Original MP3 bytes are unchanged. Playback/export use derived crossfaded loop buffers.

- Creator/source: https://bigsoundbank.com/
- Recorded licence page: https://bigsoundbank.com/licenses.html
- CC0 text: https://creativecommons.org/publicdomain/zero/1.0/legalcode

## Icons

The local SVG icons are from the official Lucide repository. The original ISC and inherited Feather MIT notices are preserved verbatim in [assets/icons/LICENSE](assets/icons/LICENSE), included in the standalone credits and as `ICON_LICENSE.txt` in release archives.

- Source: https://github.com/lucide-icons/lucide
- Asset provenance: [assets/icons/SOURCES.md](assets/icons/SOURCES.md)

## Development Tools

Playwright (Apache-2.0) is used only for isolated browser regression tests. fflate (MIT) is used only for release ZIP packaging. Their exact versions and npm integrity hashes are locked in `package-lock.json`; their upstream licence files accompany npm installations. Neither library nor a browser binary is embedded in the runtime HTML or release ZIP.

- Playwright: https://github.com/microsoft/playwright
- fflate: https://github.com/101arrowz/fflate
