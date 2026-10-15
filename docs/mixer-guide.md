# Mixer Guide

Hz Mixer starts only when you press Play. Use stereo headphones for binaural mode and a comfortable device volume. The Monitor is above Generator and Environment; it shows digital output, not sound pressure at your ears.

## Generator

- **Binaural:** separate tones at carrier minus/plus half the beat rate, one per ear.
- **Monaural:** both tones mixed into each channel.
- **Isochronic:** one carrier with a repeating amplitude envelope. Width, softness and depth shape that envelope.
- **Off:** environment/noise only.

Type precise values or use the sliders. Beat rate is 0.50-40.00 Hz in 0.01 Hz steps; carrier is 20-2000 Hz in whole hertz. The displayed two-tone frequencies are the actual intended carriers. Invalid combinations that put the lower tone at zero are blocked. Preset band labels are descriptive, not clinical recommendations or promises of entrainment.

## Frequency Programs

Fixed uses one rate. Sweep moves between start/end with linear or smooth interpolation. Once reaches the end and holds it; ping-pong repeats. Session plays up to 16 hold/sweep stages and stops at their total duration (maximum two hours).

Pause preserves progress. Editing a sweep or stage restarts the program clock. Editing the manual beat field returns to Fixed. Session duration comes from the stages. Fades shorten automatically when necessary to fit a finite session. Stop fades out; a second Stop ends playback immediately.

## Layers and Libraries

Each environment/noise channel has enable, level, mute, solo and balance. Mute wins over solo. Clicking Solo also enables that channel; disabling it clears Solo. Clear solo removes isolation but leaves enabled layers on. The balance readout resets pan to center. Generator and master have separate mute controls.

The four [recordings](../assets/audio/SOURCES.md) use derived crossfaded loops; original MP3 files are unchanged. White, pink and brown noise are synthesized locally. [Icon provenance](../assets/icons/SOURCES.md) and full licences are available in Credits.

Search/filter the 37 presets, favorite them, or save up to 30 named mixes. Saving an existing name updates that mix. JSON mix exports contain the current settings; library backups include saved mixes, current settings and preset favorites. Import previews contents before merge/replace; it does not change the current audio. Theme is separate from audio backups.

Storage belongs to the browser and origin/file location. Export a Library backup before changing browsers, moving a portable file or switching between the website and offline version. Legacy Beat Mixer JSON files and mix storage keys remain supported. See [privacy](privacy.md).

## Appearance

Choose System, Light, Green, Dark, Blue or Matrix in the header. Green retains the original dark-green palette. Dark uses a near-black background and purple shades; Blue is the renamed cyan/yellow/magenta palette; Matrix uses black/green, terminal typography and falling background code. Monitor colors follow each palette. There are no strobes or beat-synchronized light effects.

The Matrix-only pause/resume icon freezes or resumes the rain; its preference is stored separately from audio. Reduced-motion preferences disable the rain, and animation stops in hidden tabs or other themes. The rain is decorative, ignores pointer input and has no connection to the audio clock. Saved Cyberpunk selections reopen as Blue without changing the palette.

System follows the device's light/dark preference and uses the new Dark palette at night. A saved selection of the old Dark theme migrates to Green, preserving that explicit choice. Theme preferences use a separate versioned key and do not change audio, saved mixes or JSON backups. Pink/brown noise icons retain their identifying colors in every theme.

## Audio Export

Choose Audio in Export, then WAV or MP3. Both render the current normalized mix from the beginning with the same audio graph as playback: stereo routing, layer levels, mute/solo, pan, sweeps/stages, pulse settings, fades and output processing. Changes during export do not alter its snapshot.

WAV is stereo 16-bit PCM at 44.1/48 kHz. MP3 uses the same sample-rate options and 128/192/256/320 kbps (default 256), with separate left/right channels. It is lossy and includes codec delay/padding; use WAV for an uncompressed reference or exact sample count. Mono conversion elsewhere destroys binaural separation.

Duration is 1 second-2 hours. Session export duration is the stage total; other programs let you choose duration. Ordinary downloads retain encoded chunks in browser memory, not the entire uncompressed session. Direct-to-file saving appears only where supported. Cancel waits for the current offline rendering/decoding block; MP3 encoding yields in smaller batches. A cancelled direct writer is aborted rather than committed, but the native browser/OS picker must be manually checked.

The optional portable HTML contains everything needed offline. Direct file-origin behavior varies between browsers and remains a manual acceptance item. The website is static and not automatically cached for offline use. See the [main README](../README.md) for local builds and known verification gaps.
