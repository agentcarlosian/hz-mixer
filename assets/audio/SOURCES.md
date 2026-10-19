# Audio sources

Downloaded on 2026-10-05 from the creator's BigSoundBank pages. Joseph Sardin identifies each recording as CC0 and explicitly permits editing, redistribution, and commercial use without required attribution. Source pages and the [site license](https://bigsoundbank.com/licenses.html) were checked before bundling. Credit is included here even though it is optional.

| Local file | Recording | Creator | Source page | Direct file | License | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| `cascade.mp3` | Small Cascade | Joseph Sardin | https://bigsoundbank.com/small-cascade-s0507.html | https://bigsoundbank.com/UPLOAD/mp3/0507.mp3 | CC0 1.0 | `3e6fbaa07e8ef92ba2905f90105f959fba0362b69d8695cafe59b77b5bbd3106` |
| `stream.mp3` | Small Stream #4 | Joseph Sardin | https://bigsoundbank.com/small-stream-4-s1354.html | https://bigsoundbank.com/UPLOAD/mp3/1354.mp3 | CC0 1.0 | `29c6c0498b18e24d00776d99f7be35d6e35f64c2f203dee6a1d0434f9f45a927` |
| `storm.mp3` | Rain and Thunder #2 | Joseph Sardin | https://bigsoundbank.com/rain-and-storm-2-s0740.html | https://bigsoundbank.com/UPLOAD/mp3/0740.mp3 | CC0 1.0 | `056c5296303887b650e62a6dc3282f327f8a8560c061acbf577c5e0734acdb6e` |
| `waves.mp3` | Sea Waves | Joseph Sardin | https://bigsoundbank.com/sea-waves-s0698.html | https://bigsoundbank.com/UPLOAD/mp3/0698.mp3 | CC0 1.0 | `caa64ec0ffd4319f016459b3295d3f8c6eaa5209d6e95c9c5cfd897c02797a22` |

License text: https://creativecommons.org/publicdomain/zero/1.0/

These four MP3 versions are unchanged from their downloaded originals. Playback and audio export decode environmental recordings into new buffers with a 1.5-second equal-power overlap at each loop join; this shortens each playback loop slightly. Audition these processed loop transitions before a public release.

## Freesound Additions

Originals downloaded by the maintainer on 2026-10-18. The exact original asset pages were checked on that date and each explicitly listed CC0 1.0. Singing Bowl I (original title `BELL_33`, bundled as `bell-33.wav`) and Singing Bowl II (original title `BELL 37`, bundled as `bell-37.wav`) are Tibetan bowl recordings by ganapataye. Campfire is a close field recording by Nox_Sound. Creator names and source IDs are retained even though attribution is optional under CC0.

| Bundled file | Recording | Creator | Original page | Original filename | Original SHA-256 | Bundled SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| `campfire.mp3` | Ambiance_Campfire_Loop_Stereo.wav | Nox_Sound | https://freesound.org/people/Nox_Sound/sounds/558967/ | `558967__nox_sound__ambiance_campfire_loop_stereo.wav` | `ac533432f35aed4e4a1375c42f1dad505cfc4026d67ae38f37720ba1f56801b6` | `160e2315cf0509b77cd757cce5e4441932e1a5477265de24b02c536f838e5fc4` |
| `bell-33.wav` | BELL_33 | ganapataye | https://freesound.org/people/ganapataye/sounds/837372/ | `837372__ganapataye__bell_33.aiff` | `5956c4e2ec2d24b9632614b27a5d0d8d975aff1605e525bb7858d76013127097` | `ef33b133713348ec9c2e385facc6bdf7adba06fe800dd41828b30083b4727da4` |
| `bell-37.wav` | BELL 37 | ganapataye | https://freesound.org/people/ganapataye/sounds/837376/ | `837376__ganapataye__bell-37.aiff` | `a59503282f37586e390c9125e4a6af4355b3db49d87cb75a0d566936b7a34223` | `ba3ff1ee80bd3e4eff2ae643a94df2ee6de7501b654bae47c3565cda7f5a4743` |

Conversions use FFmpeg: `-map_metadata -1 -codec:a libmp3lame -b:a 192k` for Campfire (48 kHz stereo, 12.725542 seconds before encoding), and `-map_metadata -1 -codec:a pcm_s16le` for both bells (44.1 kHz, 16-bit stereo). No gain, trimming, filtering, resampling, or added reverb was applied. The AIFF-to-WAV conversions change the container and PCM byte order without reducing audio precision. Originals remain outside the public repository; hashes identify the supplied sources.

Campfire uses the same runtime crossfade as the other environmental layers. Bells retain their full one-shot recordings, with silence between scheduled strikes rather than a crossfaded or padded looping buffer. Playback and export use the same source files and interval clock.

## Window Rain

Rain on Window Loop by alxl: https://opengameart.org/content/rain-on-window-loop. The maintainer supplied `rain_on_window_loop.wav` on 2026-10-18. The original page was checked that day: CC0 is explicitly offered as one of several alternative licences, and the creator confirms that users may choose one. This project uses the CC0 option; attribution is optional, with credit retained here for provenance.

- Original WAV: 10.866259 seconds, stereo, 44.1 kHz, 16-bit PCM.
- Original SHA-256: `97b9405025e5ed7ed8a58d24dd7146d06e925519b1f718efda94bb85dcd1a61a`.
- Bundled file: `window-rain.mp3`, stereo 44.1 kHz, 192 kbps.
- Bundled SHA-256: `04a97826e2d94eb544f81ecb481a40accf9c527b03f2b9687552a934870aa605`.
- Conversion: FFmpeg 8.0.1, `-map_metadata -1 -codec:a libmp3lame -b:a 192k`. No gain, trimming, filtering, added reverb, or source resampling. The original remains unchanged outside the repository.
- Playback/export use the same runtime 1.5-second crossfade as the other environmental recordings; the processed repeat interval is approximately 9.366 seconds.
