# Third-party Notices

Hz Mixer's original source uses the root MIT licence. These bundled assets keep their own terms; the root licence does not replace them.

## Audio Recordings

The four original environmental MP3 recordings by Joseph Sardin / BigSoundBank, Campfire by Nox_Sound, and Singing Bowl I / Singing Bowl II by ganapataye were identified as CC0 1.0 at their recorded source pages. The Freesound additions are from https://freesound.org/people/Nox_Sound/sounds/558967/, https://freesound.org/people/ganapataye/sounds/837372/ and https://freesound.org/people/ganapataye/sounds/837376/. Attribution is optional under CC0; credit and provenance are retained here and inside the standalone app.

Window rain is derived from Rain on Window Loop by alxl, https://opengameart.org/content/rain-on-window-loop, using the creator's explicitly offered CC0 option. Its supplied WAV was converted to a stereo MP3. The other licence options on that page are alternatives, not additional requirements.

The [audio source manifest](assets/audio/SOURCES.md) records source URLs, dates, licence, original/derivative SHA-256 and conversion details. The four BigSoundBank MP3 files are unchanged; Campfire is a derived MP3, and the AIFF bells are converted losslessly to PCM WAV. Environmental playback/export use crossfaded loop buffers; interval bells play as one-shots.

- Creator/source: https://bigsoundbank.com/
- Recorded licence page: https://bigsoundbank.com/licenses.html
- CC0 text: https://creativecommons.org/publicdomain/zero/1.0/legalcode

## Icons

The utility/control SVG icons are from the official Lucide repository. The original ISC and inherited Feather MIT notices are preserved verbatim in [assets/icons/LICENSE](assets/icons/LICENSE), included in Credits and at the same path in release archives.

The mixer-and-waves brand and the five literal environmental illustrations are original Hz Mixer artwork under the root MIT licence, not Lucide assets. Their source files and provenance are recorded in the asset manifest below.

- Source: https://github.com/lucide-icons/lucide
- Asset provenance: [assets/icons/SOURCES.md](assets/icons/SOURCES.md)

## MP3 Encoder

`@breezystack/lamejs` 1.2.7, by Alex Zhukov and contributors, is the unmodified JavaScript LAME port under LGPL-3.0. It is separate from the MIT original code. The web build loads a separate replaceable local script only for MP3 export; the portable HTML has a separate byte-exact script block. No restriction on reverse engineering for debugging library modifications is imposed.

The [encoder directory](vendor/lamejs/README.md) documents replacement/rebuilding and contains the [exact upstream source](vendor/lamejs/source.tar.gz), [original notice](vendor/lamejs/LICENSE), [LGPL-3.0](vendor/lamejs/COPYING.LESSER) and [GPL-3.0](vendor/lamejs/COPYING). These travel with the site and ZIP; the standalone embeds the full texts, instructions and source download. The MIT licence does not replace these terms. [LAME project](https://lame.sourceforge.net/).

## Development Tools

Playwright (Apache-2.0) is used only for isolated browser regression tests. fflate (MIT) is used only for release ZIP packaging. Their exact versions and npm integrity hashes are locked in `package-lock.json`; their upstream licence files accompany npm installations. Neither library nor a browser binary is embedded in the runtime HTML or release ZIP.

- Playwright: https://github.com/microsoft/playwright
- fflate: https://github.com/101arrowz/fflate
