# MP3 Encoder Redistribution

Hz Mixer uses **@breezystack/lamejs 1.2.7**, Alex Zhukov and contributors' JavaScript port of LAME, under **LGPL-3.0**. It is unmodified. This component is not covered by Hz Mixer's MIT licence. No restriction on reverse engineering for debugging modifications to this library is imposed.

- [LAME project](https://lame.sourceforge.net/)
- [Upstream repository](https://github.com/gideonstele/lamejs)
- Published npm revision: `1fb0ef5fa177413107e2e107d054a9b994e3f79c`.
- [Exact corresponding upstream source, including build files](source.tar.gz), also available from [the upstream archive](https://github.com/gideonstele/lamejs/archive/1fb0ef5fa177413107e2e107d054a9b994e3f79c.tar.gz).
- [Upstream notice](LICENSE), [LGPL-3.0](COPYING.LESSER) and [GPL-3.0](COPYING) accompany every distribution.

The web build serves `lamejs.iife.js` as a separate script, loaded only for MP3 export. Replace it with a compatible `lamejs.Mp3Encoder` implementation to use your own modified encoder. The portable HTML has the exact same unmodified JavaScript in a separate `mp3-encoder` script block. You may replace that block directly in a text editor. It includes an encoder-source download in Credits. Hz Mixer's own unminified JavaScript is editable in that HTML; rebuilding is not required to replace the encoder there.

To rebuild from source, extract `source.tar.gz`, review its `package.json`, install the upstream build dependencies, and use its `npm run build` command. Replace `vendor/lamejs/lamejs.iife.js` with the resulting compatible build, and update the accompanying corresponding-source archive and notices when redistributing modifications. In Hz Mixer's source checkout, `npm run build` then produces both web and portable outputs from the substituted script. `npm ci` does not overwrite the vendored encoder. The locked npm dependency is used only to verify the pristine distribution, not to prevent replacement.

SHA-256 of the unmodified `lamejs.iife.js`: `0be202ec162aa3042d5c5c4e6288ad326cff8cec7312c2894a0a91ad2f9aeda1`.

SHA-256 of the exact upstream `source.tar.gz`: `af8f08f0ff9a13777f2ffff737b48e40019b53a4b21db270dd62e829574e2b83`.

The two complete GNU licence texts were retrieved from SPDX's official `license-list-data` text copies. The npm integrity hash is locked in Hz Mixer's `package-lock.json`. The unmodified encoder explicitly selects stereo mode and accepts separate left and right PCM arrays. MP3 remains lossy and adds codec delay/padding; WAV is the uncompressed reference.
